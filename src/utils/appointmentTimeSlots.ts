export interface AppointmentTimeSlot {
  value: string
  label: string
}

export const appointmentTimeSlots = createAppointmentTimeSlots(
  '00:00',
  '24:00',
  15,
)

export function createAppointmentTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
): AppointmentTimeSlot[] {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const slots: AppointmentTimeSlot[] = []

  for (
    let currentMinutes = startMinutes;
    currentMinutes < endMinutes;
    currentMinutes += intervalMinutes
  ) {
    slots.push({
      value: formatMinutesAsTime(currentMinutes),
      label: formatMinutesAsTime(currentMinutes),
    })
  }

  return slots
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)

  return hours * 60 + minutes
}

function formatMinutesAsTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
