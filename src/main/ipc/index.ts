// IPC handler registration - bridges main ↔ renderer
// All IPC channels are registered here
export { registerObsidianIpc, initObsidian } from './obsidian'
export { registerAuthIpc } from './auth'
export { registerCalendarIpc } from './calendar'
export { registerGitHubIpc } from './github'
export { registerSlackIpc } from './slack'
