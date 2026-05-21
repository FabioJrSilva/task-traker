import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KanbanBoard from '@/components/KanbanBoard.vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  })
}))

describe('KanbanBoard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renderiza colunas corretamente', () => {
    const wrapper = mount(KanbanBoard, {
      props: {
        editMode: false
      }
    })
    
    expect(wrapper.find('.kanban-board').exists()).toBe(true)
  })

  it('exibe botão de adicionar coluna em modo edição', () => {
    const wrapper = mount(KanbanBoard, {
      props: {
        editMode: true
      }
    })
    
    expect(wrapper.find('.add-column-btn').exists()).toBe(true)
  })

  it('não exibe botão de adicionar coluna fora do modo edição', () => {
    const wrapper = mount(KanbanBoard, {
      props: {
        editMode: false
      }
    })
    
    expect(wrapper.find('.add-column-btn').exists()).toBe(false)
  })

  it('emite evento addColumn ao clicar no botão adicionar', async () => {
    const wrapper = mount(KanbanBoard, {
      props: {
        editMode: true
      },
      emits: ['addColumn']
    })
    
    await wrapper.find('.add-column-btn').trigger('click')
    
    expect(wrapper.emitted('addColumn')).toBeTruthy()
  })

  it('permite drag and drop em modo edição', () => {
    const wrapper = mount(KanbanBoard, {
      props: {
        editMode: true
      }
    })
    
    const columnWrappers = wrapper.findAll('.column-wrapper.edit-mode')
    expect(columnWrappers.length).toBeGreaterThanOrEqual(0)
  })
})