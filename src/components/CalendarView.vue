<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Plus, Video, Clock, Users } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import type { Meeting } from '@/types/Meeting'
import type { Task } from '@/types/Task'

const emit = defineEmits<{
  addMeeting: [date: string]
  editMeeting: [meeting: Meeting]
  editTask: [task: Task]
}>()

const store = useTaskStore()

const currentDate = ref(new Date())
const selectedDate = ref<string | null>(null)

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  
  const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = []
  
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    days.push({
      date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
      isCurrentMonth: false
    })
  }
  
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      day: i,
      isCurrentMonth: true
    })
  }
  
  // Next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    days.push({
      date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      day: i,
      isCurrentMonth: false
    })
  }
  
  return days
})

function getTasksForDate(date: string): Task[] {
  return store.tasks.filter(t => t.date === date)
}

function getMeetingsForDate(date: string): Meeting[] {
  return store.meetings.filter(m => m.date === date)
}

function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

function goToToday() {
  currentDate.value = new Date()
}

function selectDate(date: string) {
  selectedDate.value = selectedDate.value === date ? null : date
}

function isToday(date: string): boolean {
  return date === new Date().toISOString().split('T')[0]
}

function isSelected(date: string): boolean {
  return date === selectedDate.value
}

function addMeeting(date: string) {
  emit('addMeeting', date)
}

function editMeeting(meeting: Meeting) {
  emit('editMeeting', meeting)
}

function editTask(task: Task) {
  emit('editTask', task)
}
</script>

<template>
  <div class="calendar-view">
    <div class="calendar-header">
      <div class="month-nav">
        <button @click="prevMonth" class="nav-btn">
          <ChevronLeft :size="20" />
        </button>
        <h2>{{ monthName }}</h2>
        <button @click="nextMonth" class="nav-btn">
          <ChevronRight :size="20" />
        </button>
      </div>
      <button @click="goToToday" class="today-btn">Hoje</button>
    </div>
    
    <div class="calendar-grid">
      <div class="weekday-header">
        <span>Dom</span>
        <span>Seg</span>
        <span>Ter</span>
        <span>Qua</span>
        <span>Qui</span>
        <span>Sex</span>
        <span>Sáb</span>
      </div>
      
      <div class="days-grid">
        <div 
          v-for="day in calendarDays" 
          :key="day.date"
          class="day-cell"
          :class="{ 
            'other-month': !day.isCurrentMonth,
            'today': isToday(day.date),
            'selected': isSelected(day.date)
          }"
          @click="selectDate(day.date)"
        >
          <div class="day-header">
            <span class="day-number">{{ day.day }}</span>
            <button 
              v-if="selectedDate === day.date"
              class="add-btn" 
              @click.stop="addMeeting(day.date)"
              title="Adicionar reunião"
            >
              <Plus :size="14" />
            </button>
          </div>
          
          <div class="day-content">
            <div 
              v-for="meeting in getMeetingsForDate(day.date).slice(0, 2)" 
              :key="meeting.id"
              class="meeting-indicator"
              @click.stop="editMeeting(meeting)"
            >
              <Video :size="10" />
              <span>{{ meeting.title }}</span>
            </div>
            <div 
              v-if="getMeetingsForDate(day.date).length > 2"
              class="more-indicator"
            >
              +{{ getMeetingsForDate(day.date).length - 2 }} reuniões
            </div>
            
            <div 
              v-for="task in getTasksForDate(day.date).slice(0, 2)" 
              :key="task.id"
              class="task-indicator"
              @click.stop="editTask(task)"
            >
              <span>{{ task.title }}</span>
            </div>
            <div 
              v-if="getTasksForDate(day.date).length > 2"
              class="more-indicator"
            >
              +{{ getTasksForDate(day.date).length - 2 }} tarefas
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Selected Day Details -->
    <div v-if="selectedDate" class="selected-day-panel">
      <h3>{{ new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</h3>
      
      <div class="section">
        <h4>
          <Video :size="14" />
          Reuniões
          <button @click="addMeeting(selectedDate)" class="add-btn-small">
            <Plus :size="12" />
          </button>
        </h4>
        <div v-if="getMeetingsForDate(selectedDate).length === 0" class="empty">
          Nenhuma reunião
        </div>
        <div 
          v-for="meeting in getMeetingsForDate(selectedDate)" 
          :key="meeting.id"
          class="item-card"
          @click="editMeeting(meeting)"
        >
          <div class="item-time">
            <Clock :size="12" />
            {{ meeting.time || 'Sem horário' }} ({{ meeting.duration || 0 }}min)
          </div>
          <div class="item-title">{{ meeting.title }}</div>
          <div v-if="meeting.attendees?.length" class="item-meta">
            <Users :size="10" />
            {{ meeting.attendees.join(', ') }}
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>Tarefas</h4>
        <div v-if="getTasksForDate(selectedDate).length === 0" class="empty">
          Nenhuma tarefa
        </div>
        <div 
          v-for="task in getTasksForDate(selectedDate)" 
          :key="task.id"
          class="item-card task-card"
          @click="editTask(task)"
        >
          <div class="item-title">{{ task.title }}</div>
          <div class="item-meta">
            {{ store.getStatusLabel(task.status) }} • {{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-nav h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 180px;
  text-align: center;
  text-transform: capitalize;
}

.nav-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}

.nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.today-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.today-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.calendar-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  min-height: 80px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.day-cell:hover {
  border-color: var(--accent);
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.today {
  border-color: var(--accent);
  background: rgba(126, 164, 255, 0.1);
}

.day-cell.selected {
  border-color: var(--accent);
  border-width: 2px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.day-number {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.add-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  display: flex;
}

.add-btn:hover {
  color: var(--accent);
}

.day-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meeting-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(201, 144, 192, 0.2);
  color: #c990c0;
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 9px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.task-indicator {
  background: rgba(126, 164, 255, 0.15);
  color: var(--accent);
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 9px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.more-indicator {
  font-size: 8px;
  color: var(--text-muted);
  font-style: italic;
}

.selected-day-panel {
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.selected-day-panel h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  text-transform: capitalize;
}

.section {
  margin-bottom: 12px;
}

.section h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.add-btn-small {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  margin-left: auto;
}

.add-btn-small:hover {
  color: var(--accent);
}

.empty {
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px;
  text-align: center;
}

.item-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
  cursor: pointer;
}

.item-card:hover {
  border-color: var(--accent);
}

.item-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-meta {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.task-card .item-meta {
  color: var(--accent);
}
</style>
