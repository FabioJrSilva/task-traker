<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  Clock, 
  Video,
  Plus
} from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'
import type { Task } from '@/types/Task'

const props = defineProps<{
  timeTick?: number
}>()

const emit = defineEmits<{
  addTask: [date: string]
  addAppointment: [date: string, time?: string]
  addMeeting: [date: string]
  editAppointment: [appointment: Appointment]
  editMeeting: [meeting: Meeting]
  editTask: [task: Task]
  openSettings: []
}>()

const store = useTaskStore()

type ViewType = 'day' | 'week' | 'month'

const currentView = ref<ViewType>('month')
const currentDate = ref(new Date())
const selectedDate = ref<string | null>(null)

// Computed date info
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const currentDay = computed(() => currentDate.value.getDate())

// Month name for display
const periodTitle = computed(() => {
  const date = currentDate.value
  switch (currentView.value) {
    case 'day':
      return date.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      })
    case 'week':
      const weekStart = getWeekStart(currentDate.value)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${weekStart.toLocaleDateString('pt-BR', { month: 'long' })} ${weekStart.getFullYear()}`
      } else {
        return `${weekStart.toLocaleDateString('pt-BR', { month: 'short' })} - ${weekEnd.toLocaleDateString('pt-BR', { month: 'short' })} ${weekEnd.getFullYear()}`
      }
    case 'month':
    default:
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
})

// Get tasks for a specific date
function getTasksForDate(date: string): Task[] {
  void props.timeTick
  return store.tasks.filter(t => t.date === date && !t.deletedAt)
}

function isTaskOverdue(task: Task): boolean {
  return store.isTaskOverdue(task, new Date(props.timeTick ?? Date.now()))
}

function isTaskCompletedWithDelay(task: Task): boolean {
  return store.isTaskCompletedWithDelay(task)
}

// Get meetings for a specific date
function getMeetingsForDate(date: string): Meeting[] {
  return store.meetings.filter(m => m.date === date)
}

// Get appointments for a specific date
function getAppointmentsForDate(date: string): Appointment[] {
  return store.getAppointmentsByDate(date)
}

// Navigation functions
function prevPeriod() {
  const date = currentDate.value
  switch (currentView.value) {
    case 'day':
      currentDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
      break
    case 'week':
      currentDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7)
      break
    case 'month':
      currentDate.value = new Date(date.getFullYear(), date.getMonth() - 1, 1)
      break
  }
}

function nextPeriod() {
  const date = currentDate.value
  switch (currentView.value) {
    case 'day':
      currentDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      break
    case 'week':
      currentDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
      break
    case 'month':
      currentDate.value = new Date(date.getFullYear(), date.getMonth() + 1, 1)
      break
  }
}

function goToToday() {
  currentDate.value = new Date()
  selectedDate.value = new Date().toISOString().split('T')[0]
}

function setView(view: ViewType) {
  currentView.value = view
}

// Helper: get week start (Sunday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

// Week view data - filtered by workSettings.workDays
const weekDays = computed(() => {
  const workDays = store.workSettings.workDays || [1, 2, 3, 4, 5]
  const weekStart = getWeekStart(currentDate.value)
  const days: Array<{ date: Date; dateStr: string; day: number; isToday: boolean; dayOfWeek: number }> = []
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const dayOfWeek = d.getDay()
    
    if (workDays.includes(dayOfWeek)) {
      days.push({
        date: d,
        dateStr,
        day: d.getDate(),
        isToday: dateStr === new Date().toISOString().split('T')[0],
        dayOfWeek
      })
    }
  }
  return days
})

const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Month view data
const monthDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  
  const days: Array<{ dateStr: string; day: number; isCurrentMonth: boolean; isToday: boolean }> = []
  
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startPadding - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      dateStr,
      day: d,
      isCurrentMonth: false,
      isToday: false
    })
  }
  
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      dateStr,
      day: i,
      isCurrentMonth: true,
      isToday: dateStr === new Date().toISOString().split('T')[0]
    })
  }
  
  // Next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      dateStr,
      day: i,
      isCurrentMonth: false,
      isToday: false
    })
  }
  
  return days
})

// Day view - hour slots
const hourSlots = computed(() => {
  const slots: Array<{ hour: number; label: string }> = []
  const startHour = parseInt(store.workSettings.workStartTime.split(':')[0], 10)
  const endHour = parseInt(store.workSettings.workEndTime.split(':')[0], 10)
  
  for (let h = startHour; h <= endHour; h++) {
    slots.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`
    })
  }
  return slots
})

// Event handling
function handleDayClick(dateStr: string) {
  if (currentView.value === 'month') {
    selectedDate.value = selectedDate.value === dateStr ? null : dateStr
  }
}

function handleHourClick(dateStr: string, hour: number) {
  const time = `${String(hour).padStart(2, '0')}:00`
  emit('addAppointment', dateStr, time)
}

function handleAppointmentClick(appointment: Appointment, event: MouseEvent) {
  event.stopPropagation()
  emit('editAppointment', appointment)
}

function handleMeetingClick(meeting: Meeting, event: MouseEvent) {
  event.stopPropagation()
  emit('editMeeting', meeting)
}

function handleTaskClick(task: Task, event: MouseEvent) {
  event.stopPropagation()
  emit('editTask', task)
}

function openSettings() {
  emit('openSettings')
}

// Get position/size for appointment in day view
function getAppointmentStyle(appointment: Appointment) {
  const startHour = parseInt(appointment.startTime.split(':')[0], 10)
  const startMin = parseInt(appointment.startTime.split(':')[1], 10)
  const duration = appointment.duration || 60
  
  const startOffset = (startHour - parseInt(store.workSettings.workStartTime.split(':')[0], 10)) * 60 + startMin
  const height = (duration / 60) * 48 // 48px per hour
  
  return {
    top: `${startOffset}px`,
    height: `${Math.max(height, 24)}px`
  }
}

// Week view helpers
function getWeekAppointmentStyle(appointment: Appointment) {
  const startHour = parseInt(appointment.startTime.split(':')[0], 10)
  const startMin = parseInt(appointment.startTime.split(':')[1], 10)
  const duration = appointment.duration || 60
  const startHourSettings = parseInt(store.workSettings.workStartTime.split(':')[0], 10)

  const topPx = (startHour - startHourSettings) * 48 + startMin * (48 / 60)
  const heightPx = Math.max(duration * (48 / 60), 24)

  return {
    top: `${Math.max(0, topPx)}px`,
    height: `${heightPx}px`,
  }
}

function getWeekMeetingStyle(meeting: Meeting) {
  const startHour = meeting.time ? parseInt(meeting.time.split(':')[0], 10) : 9
  const startMin = meeting.time ? parseInt(meeting.time.split(':')[1], 10) : 0
  const duration = meeting.duration || 60
  const startHourSettings = parseInt(store.workSettings.workStartTime.split(':')[0], 10)

  const topPx = (startHour - startHourSettings) * 48 + startMin * (48 / 60)
  const heightPx = Math.max(duration * (48 / 60), 24)

  return {
    top: `${Math.max(0, topPx)}px`,
    height: `${heightPx}px`,
  }
}
</script>

<template>
  <div class="calendar-container">
    <!-- Header -->
    <div class="calendar-header">
      <!-- View Selector -->
      <div class="view-tabs">
        <button 
          :class="['tab-btn', { active: currentView === 'day' }]"
          @click="setView('day')"
        >
          Dia
        </button>
        <button 
          :class="['tab-btn', { active: currentView === 'week' }]"
          @click="setView('week')"
        >
          Semana
        </button>
        <button 
          :class="['tab-btn', { active: currentView === 'month' }]"
          @click="setView('month')"
        >
          Mês
        </button>
      </div>
      
      <!-- Navigation -->
      <div class="nav-center">
        <button @click="prevPeriod" class="nav-btn">
          <ChevronLeft :size="16" />
        </button>
        <span class="period-title">{{ periodTitle }}</span>
        <button @click="nextPeriod" class="nav-btn">
          <ChevronRight :size="16" />
        </button>
      </div>
      
      <!-- Actions -->
      <div class="header-actions">
        <button @click="goToToday" class="today-btn">Hoje</button>
        <button @click="openSettings" class="settings-btn" title="Configurações">
          <Settings :size="16" />
        </button>
      </div>
    </div>
    
    <!-- Content Area -->
    <div class="calendar-content">
      
      <!-- DAY VIEW -->
      <div v-if="currentView === 'day'" class="day-view">
        <div class="day-header">
          <span class="day-name">{{ currentDate.toLocaleDateString('pt-BR', { weekday: 'long' }) }}</span>
          <span class="day-number">{{ currentDay }}</span>
        </div>
        
        <div class="time-grid">
          <!-- Time column -->
          <div class="time-column">
            <div v-for="slot in hourSlots" :key="slot.hour" class="time-slot">
              {{ slot.label }}
            </div>
          </div>
          
          <!-- Day column -->
          <div class="day-column">
            <div 
              v-for="slot in hourSlots" 
              :key="slot.hour" 
              class="hour-cell"
              @click="handleHourClick(currentDate.toISOString().split('T')[0], slot.hour)"
            ></div>
            
            <!-- Appointments -->
            <div 
              v-for="apt in getAppointmentsForDate(currentDate.toISOString().split('T')[0])"
              :key="apt.id"
              class="appointment-block"
              :style="getAppointmentStyle(apt)"
              :class="apt.color || 'default'"
              @click="handleAppointmentClick(apt, $event)"
            >
              <span class="apt-title">{{ apt.title }}</span>
              <span class="apt-time">{{ apt.startTime }}</span>
            </div>
            
            <!-- Meetings -->
            <div 
              v-for="meeting in getMeetingsForDate(currentDate.toISOString().split('T')[0])"
              :key="meeting.id"
              class="meeting-block"
              @click="handleMeetingClick(meeting, $event)"
            >
              <span class="meeting-title">{{ meeting.title }}</span>
              <span class="meeting-time">{{ meeting.time }}</span>
            </div>
          </div>
        </div>
        
        <!-- Day Tasks Panel -->
        <div class="day-panel">
          <div class="panel-section">
            <h4><Clock :size="14" /> Tarefas do dia</h4>
            <div v-if="getTasksForDate(currentDate.toISOString().split('T')[0]).length === 0" class="empty">
              Nenhuma tarefa
            </div>
              <div 
                v-for="task in getTasksForDate(currentDate.toISOString().split('T')[0])"
                :key="task.id"
                class="item-card"
                :class="{
                  'task-overdue': isTaskOverdue(task),
                  'task-completed-late': isTaskCompletedWithDelay(task)
                }"
                @click="handleTaskClick(task, $event)"
              >
                <span class="item-title">{{ task.title }}</span>
                <span class="item-meta">{{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m</span>
                <div class="task-badges">
                  <span v-if="isTaskOverdue(task)" class="task-badge overdue">Atrasada</span>
                  <span v-if="isTaskCompletedWithDelay(task)" class="task-badge completed-late">
                    Concluída com atraso
                  </span>
                </div>
              </div>
            </div>
          </div>
      </div>
      
      <!-- WEEK VIEW -->
      <div v-else-if="currentView === 'week'" class="week-view">
        <div class="week-header">
          <div class="week-time-gutter"></div>
          <div 
            v-for="day in weekDays" 
            :key="day.dateStr"
            :class="['week-day-header', { today: day.isToday }]"
          >
            <span class="week-day-name">{{ weekDayNames[day.dayOfWeek] }}</span>
            <span class="week-day-number">{{ day.day }}</span>
          </div>
        </div>
        
        <div class="week-body">
          <div class="week-time-gutter">
            <div v-for="slot in hourSlots" :key="slot.hour" class="time-label">
              {{ slot.label }}
            </div>
          </div>
          
          <div class="week-grid">
            <div 
              v-for="day in weekDays"
              :key="day.dateStr"
              class="week-day-column"
            >
              <div 
                v-for="slot in hourSlots"
                :key="slot.hour"
                class="week-hour-cell"
                @click="handleHourClick(day.dateStr, slot.hour)"
              ></div>
              
              <!-- Appointments -->
              <div 
                v-for="apt in getAppointmentsForDate(day.dateStr)"
                :key="apt.id"
                class="week-appointment"
                :style="getWeekAppointmentStyle(apt)"
                :class="apt.color || 'default'"
                @click="handleAppointmentClick(apt, $event)"
              >
                {{ apt.title }}
              </div>
              
              <!-- Meetings -->
              <div 
                v-for="meeting in getMeetingsForDate(day.dateStr)"
                :key="meeting.id"
                class="week-meeting"
                :style="getWeekMeetingStyle(meeting)"
                @click="handleMeetingClick(meeting, $event)"
              >
                <Video :size="10" />
                {{ meeting.title }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- MONTH VIEW -->
      <div v-else class="month-view">
        <div class="month-weekdays">
          <span v-for="day in weekDayNames" :key="day">{{ day }}</span>
        </div>
        
        <div class="month-grid">
          <div 
            v-for="day in monthDays"
            :key="day.dateStr"
            :class="['month-cell', { 
              'other-month': !day.isCurrentMonth,
              'today': day.isToday,
              'selected': selectedDate === day.dateStr
            }]"
            @click="handleDayClick(day.dateStr)"
          >
            <span class="month-day-number">{{ day.day }}</span>
            
            <div class="month-events">
              <!-- Meetings -->
              <div 
                v-for="meeting in getMeetingsForDate(day.dateStr).slice(0, 1)"
                :key="meeting.id"
                class="event-dot meeting-dot"
                :title="meeting.title"
                @click.stop="handleMeetingClick(meeting, $event)"
              ></div>
              <div 
                v-if="getMeetingsForDate(day.dateStr).length > 1"
                class="event-more"
              >
                +{{ getMeetingsForDate(day.dateStr).length - 1 }}
              </div>
              
              <!-- Tasks -->
              <div 
                v-for="task in getTasksForDate(day.dateStr).slice(0, 1)"
                :key="task.id"
                class="event-dot task-dot"
                :class="{
                  'task-dot-overdue': isTaskOverdue(task),
                  'task-dot-completed-late': isTaskCompletedWithDelay(task)
                }"
                :title="task.title"
                @click.stop="handleTaskClick(task, $event)"
              ></div>
              <div 
                v-if="getTasksForDate(day.dateStr).length > 1"
                class="event-more"
              >
                +{{ getTasksForDate(day.dateStr).length - 1 }}
              </div>
              
              <!-- Appointments -->
              <div 
                v-for="apt in getAppointmentsForDate(day.dateStr).slice(0, 1)"
                :key="apt.id"
                class="event-dot apt-dot"
                :title="apt.title"
                @click.stop="handleAppointmentClick(apt, $event)"
              ></div>
              <div 
                v-if="getAppointmentsForDate(day.dateStr).length > 1"
                class="event-more"
              >
                +{{ getAppointmentsForDate(day.dateStr).length - 1 }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Selected Day Details -->
        <div v-if="selectedDate" class="selected-day-panel">
          <h3>{{ new Date(selectedDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</h3>
          
          <div class="panel-row">
            <div class="panel-section">
              <h4>
                <Clock :size="14" />
                Tarefas
                <button @click="$emit('addTask', selectedDate)" class="add-btn-small">
                  <Plus :size="12" />
                </button>
              </h4>
              <div v-if="getTasksForDate(selectedDate).length === 0" class="empty">Nenhuma tarefa</div>
              <div 
                v-for="task in getTasksForDate(selectedDate)"
                :key="task.id"
                class="item-card"
                :class="{
                  'task-overdue': isTaskOverdue(task),
                  'task-completed-late': isTaskCompletedWithDelay(task)
                }"
                @click="handleTaskClick(task, $event)"
              >
                <span class="item-title">{{ task.title }}</span>
                <span class="item-meta">{{ store.getStatusLabel(task.status) }}</span>
                <div class="task-badges">
                  <span v-if="isTaskOverdue(task)" class="task-badge overdue">Atrasada</span>
                  <span v-if="isTaskCompletedWithDelay(task)" class="task-badge completed-late">
                    Concluída com atraso
                  </span>
                </div>
              </div>
            </div>
            
            <div class="panel-section">
              <h4>
                <Video :size="14" />
                Reuniões
                <button @click="$emit('addMeeting', selectedDate)" class="add-btn-small">
                  <Plus :size="12" />
                </button>
              </h4>
              <div v-if="getMeetingsForDate(selectedDate).length === 0" class="empty">Nenhuma reunião</div>
              <div 
                v-for="meeting in getMeetingsForDate(selectedDate)"
                :key="meeting.id"
                class="item-card"
                @click="handleMeetingClick(meeting, $event)"
              >
                <span class="item-title">{{ meeting.title }}</span>
                <span class="item-meta">{{ meeting.time }} ({{ meeting.duration || 0 }}min)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.calendar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
  width: 100%;
  flex-shrink: 0;
}

.view-tabs {
  display: flex;
  gap: 2px;
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: var(--bg-hover);
}

.tab-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.period-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 140px;
  text-align: center;
  text-transform: capitalize;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.today-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.today-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.settings-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.calendar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 8px;
  min-width: 0;
}

/* View Containers -统一的视图容器 */
.day-view,
.week-view,
.month-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.day-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.day-name {
  font-size: 14px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.day-number {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.time-grid {
  display: flex;
  flex: 1;
  overflow: auto;
}

.time-column {
  width: 60px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
}

.time-slot {
  height: 48px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
}

.day-column {
  flex: 1 1 0;
  min-width: 150px;
  max-width: none;
  position: relative;
  border-right: 1px solid var(--border);
}

.hour-cell {
  height: 48px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.hour-cell:hover {
  background: var(--bg-hover);
}

.appointment-block {
  position: absolute;
  left: 4px;
  right: 4px;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  z-index: 1;
}

.appointment-block.default {
  background: rgba(126, 164, 255, 0.3);
  border-left: 3px solid var(--accent);
  color: var(--text-primary);
}

.appointment-block.red { background: rgba(255, 107, 107, 0.3); border-left-color: #ff6b6b; }
.appointment-block.green { background: rgba(137, 209, 133, 0.3); border-left-color: #89d185; }
.appointment-block.purple { background: rgba(201, 144, 192, 0.3); border-left-color: #c990c0; }
.appointment-block.orange { background: rgba(255, 171, 45, 0.3); border-left-color: #ffab2d; }

.apt-title {
  display: block;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.apt-time {
  font-size: 10px;
  color: var(--text-muted);
}

.meeting-block {
  position: absolute;
  right: 4px;
  width: 120px;
  background: rgba(201, 144, 192, 0.2);
  border: 1px solid #c990c0;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  z-index: 2;
}

.meeting-title {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meeting-time {
  font-size: 10px;
  color: var(--text-muted);
}

.day-panel {
  border-top: 1px solid var(--border);
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.panel-section h4 {
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

/* Week View */
.week-view {
  display: flex;
  flex-direction: column;
}

.week-header {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.week-time-gutter {
  width: 60px;
  flex-shrink: 0;
}

.week-day-header {
  flex: 1 1 0;
  min-width: 100px;
  max-width: none;
  text-align: center;
  padding: 8px;
  border-left: 1px solid var(--border);
}

.week-day-header.today {
  background: rgba(126, 164, 255, 0.1);
}

.week-day-name {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.week-day-number {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.week-body {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
}

.week-time-gutter .time-label {
  height: 48px;
  padding: 4px 8px;
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
}

.week-grid {
  display: flex;
  flex: 1 1 0;
}

.week-day-column {
  flex: 1 1 0;
  min-width: 250px;
  max-width: none;
  position: relative;
  border-left: 1px solid var(--border);
}

.week-hour-cell {
  height: 48px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.week-hour-cell:hover {
  background: var(--bg-hover);
}

.week-appointment {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 10px;
  overflow: hidden;
  cursor: pointer;
  z-index: 1;
}

.week-appointment.default {
  background: rgba(126, 164, 255, 0.4);
  border-left: 2px solid var(--accent);
}

.week-meeting {
  position: absolute;
  left: 2px;
  right: 2px;
  background: rgba(201, 144, 192, 0.3);
  border-left: 2px solid #c990c0;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  z-index: 2;
}

/* Month View */
.month-view {
  display: flex;
  flex-direction: column;
}

.month-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex-shrink: 0;
}

.weekday-cell {
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  overflow: auto;
}

.month-cell {
  min-height: 80px;
  padding: 4px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.month-cell:hover {
  border-color: var(--accent);
}

.month-cell.other-month {
  opacity: 0.4;
}

.month-cell.today {
  border-color: var(--accent);
  background: rgba(126, 164, 255, 0.1);
}

.month-cell.selected {
  border-color: var(--accent);
  border-width: 2px;
}

.month-day-number {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.month-events {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.meeting-dot { background: #c990c0; }
.task-dot { background: var(--accent); }
.apt-dot { background: #ffab2d; }

.task-dot-overdue {
  background: var(--danger, #e74c3c);
}

.task-dot-completed-late {
  background: #f59e0b;
}

.event-more {
  font-size: 9px;
  color: var(--text-muted);
}

.selected-day-panel {
  border-top: 1px solid var(--border);
  padding: 12px;
  background: var(--bg-primary);
}

.selected-day-panel h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  text-transform: capitalize;
}

.panel-row {
  display: flex;
  gap: 16px;
}

.panel-section {
  flex: 1;
}

/* Common styles */
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

.item-card.task-overdue {
  border-color: var(--danger, #e74c3c);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger, #e74c3c) 40%, transparent);
}

.item-card.task-completed-late {
  border-color: #f59e0b;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 40%, transparent);
}

.item-title {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-meta {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.task-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.task-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.task-badge.overdue {
  background: color-mix(in srgb, var(--danger, #e74c3c) 20%, transparent);
  color: var(--danger, #e74c3c);
  border-color: color-mix(in srgb, var(--danger, #e74c3c) 40%, transparent);
}

.task-badge.completed-late {
  background: color-mix(in srgb, #f59e0b 20%, transparent);
  color: #f59e0b;
  border-color: color-mix(in srgb, #f59e0b 40%, transparent);
}

/* Responsive - Kanban pattern (overflow scroll) */
.calendar-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.day-view {
  overflow: auto;
}

.day-column {
  min-width: 150px;
  flex: 1 1 0;
}

.week-columns {
  display: flex;
  min-width: 100%;
}

.week-column {
  min-width: 100px;
  flex: 1;
  flex-shrink: 0;
}

.month-weeks {
  display: flex;
  flex-wrap: wrap;
  min-width: 100%;
}

.month-cell {
  min-width: 80px;
  flex: 1 1 0;
}
</style>
