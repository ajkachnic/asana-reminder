import dotenv from 'dotenv'
dotenv.config()

import twilio from 'twilio'
import asana from 'asana'
import cron from 'node-cron'
import chalk from 'chalk'

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
const asanaClient = asana.Client.create()
asanaClient.useAccessToken(process.env.ASANA_TOKEN || '')

const name = 'Andrew'

interface Task {
  name: string
  gid: string
  resource_type: string
  tags: unknown[]
}

const createLog = <T = string>(message: T, type: 'success' | 'warn' | 'error' = 'success') => {
  switch(type) {
    case 'success':
      console.log(chalk.white.bgGreen.bold('SUCCESS: ') + message)
      break
    case 'warn':
      console.warn(chalk.white.bgYellow.bold('WARN: ') + message)
      break
    case 'error':
      console.error(chalk.white.bgRed.bold('ERROR: ') + message)
      break
  }
}

const sendMessage = async (body: string) => {
  const message = await twilioClient.messages.create({
    body,
    from: process.env.FROM_NUMBER,
    to: process.env.TO_NUMBER || '',
  })
  createLog(`Message sent at ${new Date().toDateString()}`)
}

const getTasks = async () => {
  try {
    const me = await asanaClient.users.me()
    const workspaceId = me.workspaces[0].gid;
    const tasks = (await asanaClient.tasks.findAll({
      // @ts-ignore
      assignee: me.gid,
      // @ts-ignore
      workspace: workspaceId,
      completed_since: 'now',
      opt_fields: 'id,name,assignee_status,completed'
    })).data.filter(task => {
      return task.assignee_status === 'today' ||
        task.assignee_status === 'new';
    })

    return tasks
  } catch(err) {
    createLog(err, 'error')    
  }
}

const formatTasks = (tasks: {
  name: string
  [key: string]: unknown
}[]) => {
  const names = tasks.map(task => task.name)
  if (names.length > 0) {
    return '- ' + names.join('\n- ')
  }
  return '...this is awkward; either you\'re magic ✨ or you forgot to make a todo list yesterday... idiot'
}

const morningMessage = async () => {
  const tasks = await getTasks()
  // @ts-expect-error
  const formatted = formatTasks(tasks)

  const message = `Good morning, Andrew
Here are your tasks for the day:
${formatted}`
  
  sendMessage(message)

}

const nightMessage = async () => {
  const message = `Good night, ${name}
Remember to make your todo list for tommorow if you haven't already`
  
  sendMessage(message)
}

// Every day at 8AM
cron.schedule('0 8 * * *', morningMessage)
cron.schedule('0 20 * * *', nightMessage)