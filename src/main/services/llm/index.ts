export {
  chatCompletion,
  chatCompletionStream,
  EmptyChatCompletionError
} from './ChatCompletionService'
export type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatResponseFormat
} from './ChatCompletionService'
export {
  currentProviderId,
  defaultChatModel,
  isReasoningModel,
  normalizeModel,
  resolveProvider
} from './ChatProvider'
export { loadLLMContext, loadVaultFiles } from './contextLoader'
