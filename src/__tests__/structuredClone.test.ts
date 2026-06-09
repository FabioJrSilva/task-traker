import { describe, expect, it } from 'vitest'
import { deepClone, createDefaultAppData } from '@/shared/appData'

describe('deepClone com structuredClone', () => {
  it('clona objetos simples preservando undefined', () => {
    const original = { a: 1, b: undefined, c: null, d: 'texto' }
    const cloned = deepClone(original)

    expect(cloned.a).toBe(1)
    expect(cloned.b).toBeUndefined()
    expect('b' in cloned).toBe(true)
    expect(cloned.c).toBeNull()
    expect(cloned.d).toBe('texto')
  })

  it('clona arrays preservando itens undefined', () => {
    const original = [undefined, 'a', undefined, 'b']
    const cloned = deepClone(original)

    expect(cloned.length).toBe(4)
    expect(cloned[0]).toBeUndefined()
    expect(0 in cloned).toBe(true)
    expect(cloned[1]).toBe('a')
    expect(cloned[2]).toBeUndefined()
    expect(2 in cloned).toBe(true)
    expect(cloned[3]).toBe('b')
  })

  it('clona objetos aninhados e produz clone independente', () => {
    const original = { nested: { value: 1, extra: undefined } }
    const cloned = deepClone(original)

    expect(cloned.nested.value).toBe(1)
    expect(cloned.nested.extra).toBeUndefined()
    expect('extra' in cloned.nested).toBe(true)

    // Independência: mutação no clone não afeta original
    cloned.nested.value = 999
    expect(original.nested.value).toBe(1)
    expect(cloned.nested.value).toBe(999)
  })

  it('clona Date corretamente (structuredClone suporta Date)', () => {
    const original = { createdAt: new Date('2026-01-15T10:00:00.000Z') }
    const cloned = deepClone(original)

    expect(cloned.createdAt).toBeInstanceOf(Date)
    expect(cloned.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z')
  })

  it('fallback JSON não quebra com valores válidos', () => {
    // JSON fallback perde undefined mas deve preservar o resto
    const original = { id: 'x', title: 'teste', value: 42, flag: true }
    const cloned = deepClone(original)

    expect(cloned.id).toBe('x')
    expect(cloned.title).toBe('teste')
    expect(cloned.value).toBe(42)
    expect(cloned.flag).toBe(true)
  })

  it('createDefaultAppData retorna clone independente (não compartilha referências)', () => {
    const data1 = createDefaultAppData()
    const data2 = createDefaultAppData()

    // Mesmo conteúdo
    expect(data1.columns).toEqual(data2.columns)
    expect(data1.workSettings).toEqual(data2.workSettings)

    // Referências diferentes
    expect(data1.columns).not.toBe(data2.columns)
    expect(data1.workSettings).not.toBe(data2.workSettings)

    // Mutação não afeta defaults
    data1.columns.push({ id: 'extra', title: 'Extra', status: 'extra', order: 99, color: '#000' })
    expect(data2.columns.length).toBe(4)
  })
})
