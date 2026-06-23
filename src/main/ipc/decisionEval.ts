/**
 * Decision Evaluation IPC Handler
 *
 * Exposes the decision eval service to the renderer via IPC.
 */
import { ipcMain } from 'electron'
import log from 'electron-log'
import { evaluateDecisions, invalidateEvalCache } from '../services/eval/DecisionEvalService'
import type { EvaluatedDecision } from '../../shared/types/transcription'

export function registerDecisionEvalIpc(): void {
  ipcMain.handle(
    'decisionEval:evaluate',
    async (_event, decisions: string[]): Promise<EvaluatedDecision[]> => {
      try {
        log.info(`[IPC] decisionEval:evaluate — evaluating ${decisions.length} decisions`)
        return await evaluateDecisions(decisions)
      } catch (error) {
        log.error('[IPC] decisionEval:evaluate error:', error)
        throw error
      }
    }
  )

  ipcMain.handle('decisionEval:invalidateCache', async (): Promise<void> => {
    invalidateEvalCache()
  })
}
