# DESIGN.md — Task Tracker Visual Language

> Padrões visuais e de layout extraídos do codebase.  
> Todo novo componente deve seguir estas convenções.

---

## 1. Sistema de Temas

CSS custom properties em `:root` (dark) e `[data-theme="light"]`. O tema é persistido via `localStorage` e alternado no header.

**Nunca usar cores hardcoded.** Sempre referenciar variáveis:

```css
/* ✅ Correto */
background: var(--bg-primary);
color: var(--text-primary);
border: 1px solid var(--border);

/* ❌ Errado */
background: #1e1e1e;
```

### Paleta principal

| Variável | Dark | Light | Uso |
|----------|------|-------|-----|
| `--bg-primary` | `#1e1e1e` | `#ffffff` | Fundo da página |
| `--bg-secondary` | `#252526` | `#f3f3f3` | Fundo de cards, menus |
| `--bg-tertiary` | `#2d2d2d` | `#e8e8e8` | Fundo de inputs, botões |
| `--bg-hover` | `#323233` | `#d4d4d4` | Hover state |
| `--border` | `#3e3e42` | `#d4d4d4` | Bordas padrão |
| `--border-light` | `#4e4e52` | `#c0c0c0` | Bordas sutis |
| `--text-primary` | `#d4d4d4` | `#1e1e1e` | Texto principal |
| `--text-secondary` | `#a0a0a0` | `#5a5a5a` | Texto secundário neutro (ícones, placeholders, labels) |
| `--text-muted` | `#9a9a9a` | `#616161` | Texto terciário (meta, datas, badges) |
| `--accent` | `#7ea4ff` | `#0078d4` | Ações primárias, foco, destaque/links |

> **Hierarquia de texto:** `--text-secondary` e `--text-muted` são **cinzas neutros** — nunca
> coloridos. Para destacar algo interativo ou um link, use `--accent`. Ambos os tons de
> texto secundário atendem ao contraste mínimo WCAG AA (4.5:1) sobre todas as superfícies.

### Tokens de escala

Definidos em `:root` (independentes de tema). Use-os em componentes novos:

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | `4px` | Botões, inputs, campos |
| `--radius-md` | `6px` | Cards, dropdowns |
| `--radius-lg` | `8px` | Modais, colunas Kanban |
| `--radius-pill` | `999px` | Badges |
| `--fs-xs` … `--fs-xl` | `11/12/13/14/16/18px` | Escala tipográfica |
| `--transition-fast` | `0.15s ease` | Hover, foco, toggle |
| `--transition-slow` | `0.3s ease` | Expandir/colapsar layout |
| `--accent-hover` | `#a3c2ff` | `#106ebe` | Hover do accent |
| `--success` | `#89d185` | `#107c10` | Concluído |
| `--warning` | `#dcdcaa` | `#cdab31` | Atenção |
| `--danger` | `#f48771` | `#d13438` | Erro, exclusão |
| `--waiting` | `#c990c0` | `#881798` | Aguardando |
| `--selection` | `#264f78` | `#add6ff` | Seleção de texto |

---

## 2. Tipografia

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

| Uso | Tamanho | Peso | Cor |
|-----|---------|------|-----|
| Base (body) | 14px | 400 | `--text-primary` |
| Título de página (h1) | 18px | 600 | `--text-primary` |
| Corpo, botões, inputs | 13px | 400 | `--text-primary` |
| Labels, chips | 12px | 400 | `--text-secondary` |
| Meta, datas, badges | 11px | 400-600 | `--text-muted` |
| Group labels (dropdown) | 11px | 600, uppercase | `--text-muted` |

**`11px` é o piso** — nunca usar texto abaixo disso (legibilidade). Escala válida:
`11 / 12 / 13 / 14 / 16 / 18px`, exposta via tokens `--fs-xs` … `--fs-xl`.

---

## 3. Espaçamento e Layout

### Grid/Gap

```css
gap: 4px;   /* Elementos muito próximos (view switcher) */
gap: 8px;   /* Entre ícone e texto, labels */
gap: 10px;  /* Entre campos de formulário */
gap: 12px;  /* Entre seções, sidebar */
```

### Header

```css
height: 52px;
padding: 0 16px;
background: var(--bg-secondary);
border-bottom: 1px solid var(--border);
display: flex;
align-items: center;
justify-content: space-between;
```

### Área de conteúdo

```css
flex: 1;
display: flex;
flex-direction: column;
min-width: 0;
min-height: 0;
gap: 12px;
overflow: hidden;
```

---

## 4. Bordas e Sombras

| Elemento | border-radius | Box-shadow |
|----------|---------------|------------|
| Botões, inputs, campos | 4px | — |
| Dropdowns, menus, modais | 6px | `0 10px 24px rgba(0,0,0,0.18)` |
| Chips de label | 16px | — |
| Badges | 999px (pill) | — |
| Colunas Kanban | 8px | — |
| Cards de tarefa | 6px | — |

---

## 5. Botões

### Padrão geral

```css
display: flex / inline-flex;
align-items: center;
gap: 6px;
border: none;
border-radius: 4px;
font-size: 13px;
cursor: pointer;
transition: background-color var(--transition-fast), color var(--transition-fast),
  border-color var(--transition-fast);
```

### Variantes

| Classe | Uso | Exemplo |
|--------|-----|---------|
| `.btn-icon` | Ícone em botão quadrado, com borda | Ações do header, toggle de tema |
| `.btn-icon.active` | Botão toggle ativo | View switcher selecionado |
| `.btn-primary` | Ação principal do modal | Salvar, Confirmar |
| `.btn-secondary` | Ação secundária | Cancelar |
| `.btn-ghost` (implícito) | Item de menu, dropdown | Settings, More |

### Tamanho de toque

Todos os controles interativos devem ter pelo menos **36px** de altura/largura (ideal 40px para mobile).

---

## 6. Inputs e Formulários

```css
/* Padrão de input */
padding: 8px 10px;
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: 4px;
color: var(--text-primary);
font-size: 13px;
```

```css
/* Foco */
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}
```

**Label de campo:**
```css
display: block;
margin-bottom: 6px;
font-size: 12px;
font-weight: 500;
color: var(--text-muted);
text-transform: uppercase;
letter-spacing: 0.05em;
```

---

## 7. Modais

```css
/* Overlay */
position: fixed;
inset: 0;
background: rgba(0, 0, 0, 0.5);
display: grid;
place-items: center;
z-index: 100;

/* Corpo do modal */
position: relative;
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: 8px;
max-width: 500px;
width: 100%;
max-height: 90vh;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
```

**Header do modal:**
```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 14px 20px;
border-bottom: 1px solid var(--border);
/* Título: font-size 16px, font-weight 600 */
```

**Corpo do modal:** `padding: 20px;`

**Footer do modal:**
```css
display: flex;
justify-content: flex-end;
gap: 10px;
padding: 14px 20px;
border-top: 1px solid var(--border);
```

---

## 8. Dropdowns e Menus

```css
position: absolute;
top: calc(100% + 8px);
right: 0;
min-width: 220px;
padding: 6px;
display: flex;
flex-direction: column;
gap: 4px;
background: var(--bg-secondary);
border: 1px solid var(--border);
border-radius: 6px;
box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
z-index: 30;

/* Item de menu */
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-hover);
}
```

---

## 9. Ícones

- **Biblioteca:** `lucide-vue-next`
- **Tamanho padrão:** 16px (ícone em linha), 18px (ícone standalone)
- **Cor:** herda do texto (`currentColor` implícito)
- **Sempre dentro de botão** com `aria-label` descritivo

```html
<button class="btn-icon" aria-label="Alternar tema" @click="toggleTheme()">
  <Sun :size="18" />
</button>
```

---

## 10. Estados e Feedback

### Loading

```css
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

### Toast

Ver `src/utils/toast.ts` e `src/components/ToastContainer.vue`. Mensagens em português, cantos inferiores, auto-dismiss.

### ConfirmDialog

Modal genérico com título, mensagem, botões Confirmar/Cancelar. Usado antes de operações destrutivas.

### Empty states

```css
color: var(--text-muted);
font-size: 13px;
text-align: center;
padding: 20px;
```

---

## 11. Animações e Transições

**Sempre listar as propriedades animadas** — nunca usar `transition: all` (anima
propriedades de layout sem querer e prejudica a performance). Animar apenas
`background-color`, `border-color`, `color`, `box-shadow`, `opacity` e `transform`.

```css
/* ✅ Correto */
transition: background-color var(--transition-fast), border-color var(--transition-fast);

/* ❌ Errado */
transition: all 0.15s ease;
```

Use os tokens `--transition-fast` (`0.15s ease`, hover/foco/toggle) e
`--transition-slow` (`0.3s ease`, expandir/colapsar).

**Movimento reduzido:** `main.css` já desativa transições e animações globalmente
sob `@media (prefers-reduced-motion: reduce)`. Nenhum componente precisa repetir isso.

**Não usar animações complexas** — o app favorece transições sutis para manter sensação de ferramenta de produtividade, não de site de marketing.

---

## 12. Responsividade

O app é desktop-first (Electron, 1400×900px). Media queries existem para telas menores:

```css
@media (max-width: 680px) { ... }
```

Nunca usar `max-width` fixo que quebre acima de 900px.

---

## 13. Acessibilidade

- Todo controle interativo deve ter `aria-label` (ícones) ou texto visível
- View switcher usa `aria-pressed` no botão ativo
- Menus fecham com `Escape` e clique fora
- Navegação por teclado: setas + Enter nos dropdowns
- Cor nunca é o único meio de transmitir informação
- **Foco visível:** `main.css` aplica um anel de foco global via `:focus-visible`
  (`outline: 2px solid var(--accent)`). Não usar `outline: none` sem fornecer um
  indicador de foco alternativo. Inputs podem manter o realce de borda.
- **Contraste:** todo par texto/fundo deve atingir 4.5:1 (AA). Os tokens
  `--text-secondary` e `--text-muted` já foram calibrados para isso.
- **Movimento reduzido** é respeitado globalmente (ver seção 11).

---

## 14. Regras para Novos Componentes

1. Usar `<script setup lang="ts">` com `<style scoped>`
2. Todas as cores via `var(--*)` — sem hex hardcoded, sem fallback inline (`var(--danger)`, nunca `var(--danger, #e74c3c)`)
3. Seguir a escala de font-size `11/12/13/14/16/18px` (tokens `--fs-*`); piso de 11px
4. border-radius via tokens: `--radius-sm` (input/botão), `--radius-md` (card/dropdown), `--radius-lg` (modal)
5. Gap consistente: 4-12px conforme proximidade
6. Ícones `lucide-vue-next`, tamanho 16-18px
7. Transições sempre com propriedades explícitas + tokens `--transition-fast`/`--transition-slow`; nunca `transition: all`
8. Altura mínima de toque: 36px
9. Texto secundário/terciário em cinza neutro (`--text-secondary`/`--text-muted`); destaque só com `--accent`
10. Não remover o foco visível (`:focus-visible`) sem indicador alternativo
11. Mensagens de erro/confirmação em português
12. Nunca importar biblioteca externa de componentes UI
