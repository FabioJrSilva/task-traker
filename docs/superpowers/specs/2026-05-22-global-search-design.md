# Busca Global do Header — Design Spec

**Data:** 2026-05-22  
**Status:** Aprovado em conversa, pendente de revisão final do arquivo

---

## Visão geral

O campo central do header não deve mais funcionar como atalho visual para a Command Palette.
Ele deve se tornar uma busca global real, com dropdown inline abaixo do próprio campo, focada em
encontrar conteúdo navegável do app.

A Command Palette continua existindo separadamente como mecanismo de comando, acionada por
`Ctrl+K` / `Cmd+K`, sem disputar a mesma semântica do campo de busca.

---

## Objetivo

Separar claramente dois comportamentos:

- **Busca global:** encontrar tarefas, reuniões, compromissos e projetos
- **Command Palette:** executar ações e navegação do app

Isso corrige a ambiguidade atual, em que o componente parece busca mas se comporta como launcher
de comandos.

---

## Decisão de UX

### Campo do header

O elemento central do header passa a ser uma busca global de conteúdo.

Comportamento esperado:

- foco no campo prepara a busca global
- digitação abre um dropdown inline, ancorado ao input
- resultados aparecem agrupados por tipo
- `Esc` fecha o dropdown
- clique fora fecha o dropdown
- `Enter` abre o primeiro resultado ativo
- `ArrowUp` / `ArrowDown` navegam entre resultados

O texto visível do campo deve comunicar busca de conteúdo, não execução de comando.

Placeholder recomendado:

`Buscar tarefas, reuniões, compromissos e projetos`

Regra para query vazia:

- focar no campo vazio **não** abre resultados automaticamente
- o dropdown só aparece após existir ao menos 1 caractere na busca
- ao limpar a query, o dropdown fecha

### Dropdown inline

Os resultados devem abrir abaixo do campo, sem modal e sem overlay de tela cheia.

Razão:

- preserva o layout atual
- mantém a percepção de “campo de busca”
- reduz fricção para uso frequente

### Command Palette

Permanece separada da busca global:

- `Ctrl+K` / `Cmd+K` continua abrindo a palette
- a palette continua focada em ações como `Nova tarefa`, `Abrir Insights`, `Backup`,
  `Alternar tema`
- o campo do header não deve mais abrir a palette ao clicar

Se existir atalho visual da palette no header, ele deve ser discreto e separado do campo de
busca.

---

## Escopo de resultados

A busca global deve retornar apenas conteúdo navegável:

- **Tarefas**
- **Reuniões**
- **Compromissos**
- **Projetos**

Não incluir ações na lista de resultados da busca global.

---

## Estrutura dos resultados

Os resultados devem ser agrupados visualmente por tipo:

- `Tarefas`
- `Reuniões`
- `Compromissos`
- `Projetos`

Cada item deve mostrar:

- título principal
- tipo ou metadado secundário curto
- data, status ou projeto quando isso ajudar a diferenciar itens

Exemplos:

- tarefa: título + status + projeto
- reunião: título + data/hora
- compromisso: título + data/hora
- projeto: nome + indicador de projeto

Quando não houver resultados, o dropdown deve mostrar um estado vazio curto, em português,
sem sugerir comandos.

Texto recomendado:

`Nenhum resultado encontrado`

---

## Navegação ao selecionar

Cada tipo de item deve abrir o fluxo já existente no app:

- **Tarefa:** abre modal de edição da tarefa
- **Reunião:** abre modal de edição da reunião
- **Compromisso:** abre modal de edição do compromisso
- **Projeto:** abre modal de edição do projeto

A busca global não deve introduzir nova página, nova sidebar ou nova navegação para esses itens.
Ela deve reutilizar os modais e handlers já existentes em `App.vue`.

---

## Requisitos funcionais

- a busca deve funcionar sobre os dados já carregados localmente no app
- a filtragem deve ser client-side, sem dependência remota
- itens soft-deletados não devem aparecer
- a busca deve ignorar diferença entre maiúsculas e minúsculas
- o dropdown deve abrir apenas quando o campo estiver focado **e** houver query não vazia
- `Enter` deve abrir o primeiro item navegável atualmente destacado
- ao selecionar um item, o dropdown fecha e o campo limpa
- `Ctrl+K` / `Cmd+K` deve continuar funcionando para a Command Palette
- o header não deve exibir hint de `Ctrl+K` dentro do campo de busca global

---

## Arquitetura proposta

### `App.vue`

Responsabilidades:

- manter o valor de query da busca global
- controlar abertura/fechamento do dropdown
- receber resultados agrupados
- despachar abertura do modal correto ao selecionar um item

Também deve continuar responsável por:

- Command Palette
- modais globais
- view atual

### Novo composable de busca global

Adicionar um composable dedicado, separado da Command Palette, por exemplo:

`src/composables/useGlobalSearch.ts`

Responsabilidades:

- filtrar e agrupar resultados
- mapear resultados em uma estrutura única para navegação por teclado
- expor helpers puros e testáveis

Tipos esperados:

- union de item buscável (`task`, `meeting`, `appointment`, `project`)
- estrutura agrupada por seção
- lista linear auxiliar para navegação por teclado

### Fronteira com a Command Palette

`useGlobalSearch` e `useCommandPalette` devem permanecer separados.

Motivo:

- semânticas diferentes
- dados e resultados diferentes
- menor acoplamento
- testes mais simples

Não transformar a busca global em extensão da palette existente.

---

## Acessibilidade e interação

- input com `aria-label` descritivo
- dropdown com papéis adequados para lista de resultados
- item ativo perceptível visualmente
- navegação por teclado completa com setas e `Enter`
- `Esc` fecha dropdown sem efeitos colaterais
- clique fora fecha dropdown
- área clicável dos itens deve seguir a densidade já usada no app

---

## Regras visuais

- manter a linguagem atual do header
- o campo continua centralizado
- não usar overlay/modal para a busca
- dropdown deve parecer extensão natural do campo
- raio, borda e cores devem seguir os controles do header
- os grupos devem ser legíveis sem virar um painel pesado

---

## Testes esperados

### Vitest

Criar testes para o composable/helper da busca global:

- query vazia não retorna dropdown aberto nem lista visível
- query por substring encontra tarefas, reuniões, compromissos e projetos
- itens deletados não aparecem
- agrupamento por tipo permanece estável
- navegação linear respeita a ordem visual dos grupos

### Testes de componente / App

- foco e digitação no campo exibem o dropdown
- `Esc` fecha
- clique fora fecha
- selecionar tarefa abre o modal correto
- selecionar reunião abre o modal correto
- selecionar compromisso abre o modal correto
- selecionar projeto abre o modal correto
- clicar no campo não abre a Command Palette
- `Ctrl+K` continua abrindo a Command Palette

### Playwright

- busca global encontra tarefa existente
- busca global encontra projeto existente
- busca global não exibe comandos
- `Ctrl+K` continua abrindo a palette

---

## Fora de escopo

- fuzzy search avançada
- resultados híbridos de conteúdo + ações
- busca remota
- histórico de buscas recentes
- ranking inteligente
- redesign completo do header
- substituir a Command Palette
