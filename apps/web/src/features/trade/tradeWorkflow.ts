import type { Hex } from 'viem'
import type { SwapJob } from './tradeApi'
import { assertNever } from './tradeUtils'

export type SwapWorkflow =
  | { status: 'idle'; message: string }
  | { status: 'submitting'; message: string }
  | { status: 'polling'; message: string; swap: SwapJob }
  | { status: 'action_required'; message: string; swap: SwapJob }
  | { status: 'ready_to_sign'; message: string; swap: SwapJob }
  | { status: 'wallet_pending'; message: string; swap: SwapJob }
  | { status: 'submitted'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'confirmed'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'confirmation_unknown'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'failed'; message: string; swap?: SwapJob; txHash?: Hex }

export type SwapWorkflowAction =
  | { type: 'reset'; message?: string }
  | { type: 'submitting' }
  | { type: 'polling'; swap: SwapJob }
  | { type: 'swap_ready'; swap: SwapJob }
  | { type: 'wallet_pending'; swap: SwapJob; message: string }
  | { type: 'submitted'; swap: SwapJob; txHash: Hex }
  | { type: 'confirmed'; swap: SwapJob; txHash: Hex }
  | { type: 'confirmation_unknown'; swap: SwapJob; txHash: Hex }
  | { type: 'failed'; message: string; swap?: SwapJob; txHash?: Hex }

export const initialSwapWorkflow: SwapWorkflow = { status: 'idle', message: 'Enter an amount' }

export function swapWorkflowReducer(_: SwapWorkflow, action: SwapWorkflowAction): SwapWorkflow {
  switch (action.type) {
    case 'reset':
      return { status: 'idle', message: action.message ?? 'Enter an amount' }
    case 'submitting':
      return { status: 'submitting', message: 'Requesting route' }
    case 'polling':
      return { status: 'polling', message: stageMessage(action.swap), swap: action.swap }
    case 'swap_ready':
      if (action.swap.status === 'action_required') return { status: 'action_required', message: actionMessage(action.swap), swap: action.swap }
      if (action.swap.status === 'completed') return { status: 'ready_to_sign', message: 'Swap transaction ready', swap: action.swap }
      if (action.swap.status === 'failed') return { status: 'failed', message: action.swap.error?.message ?? 'Swap failed', swap: action.swap }
      return { status: 'polling', message: stageMessage(action.swap), swap: action.swap }
    case 'wallet_pending':
      return { status: 'wallet_pending', message: action.message, swap: action.swap }
    case 'submitted':
      return { status: 'submitted', message: 'Confirming transaction', swap: action.swap, txHash: action.txHash }
    case 'confirmed':
      return { status: 'confirmed', message: 'Swap confirmed', swap: action.swap, txHash: action.txHash }
    case 'confirmation_unknown':
      return { status: 'confirmation_unknown', message: 'Confirmation pending', swap: action.swap, txHash: action.txHash }
    case 'failed':
      return failedWorkflow(action)
    default:
      return assertNever(action)
  }
}

export function swapFromWorkflow(workflow: SwapWorkflow): SwapJob | null {
  switch (workflow.status) {
    case 'idle':
    case 'submitting':
    case 'failed':
      return 'swap' in workflow ? workflow.swap ?? null : null
    case 'polling':
    case 'action_required':
    case 'ready_to_sign':
    case 'wallet_pending':
    case 'submitted':
    case 'confirmed':
    case 'confirmation_unknown':
      return workflow.swap
    default:
      return assertNever(workflow)
  }
}

export function visibleSwapWorkflow(
  workflow: SwapWorkflow,
  assetsStatus: 'pending' | 'error' | 'success',
  error: Error | null,
  isSignedIn: boolean,
  hasAssets: boolean,
  hasSameAsset: boolean,
): SwapWorkflow {
  if (!isSignedIn) return { status: 'idle', message: 'Sign in to trade' }
  if (assetsStatus === 'pending') return { status: 'idle', message: 'Loading assets' }
  if (assetsStatus === 'error') return { status: 'failed', message: error?.message ?? 'Unable to load assets' }
  if (!hasAssets) return { status: 'failed', message: 'No tradable assets' }
  if (hasSameAsset) return { status: 'failed', message: 'Select a different token' }

  return workflow
}

export function actionButtonLabel(workflow: SwapWorkflow): string {
  switch (workflow.status) {
    case 'idle':
      return workflow.message
    case 'submitting':
    case 'polling':
    case 'wallet_pending':
      return workflow.message
    case 'action_required': {
      const action = workflow.swap.requiredActions.find((requiredAction) => !requiredAction.fulfilled)
      if (action?.type === 'approval') return 'Approve Token'
      if (action?.type === 'permit') return 'Sign Permit'
      return 'Continue'
    }
    case 'ready_to_sign':
      return 'Confirm Swap'
    case 'submitted':
      return 'Confirming'
    case 'confirmed':
      return 'Confirmed'
    case 'confirmation_unknown':
      return 'Pending'
    case 'failed':
      return workflow.message
    default:
      return assertNever(workflow)
  }
}

export function isBusyWorkflow(workflow: SwapWorkflow): boolean {
  return workflow.status === 'submitting' || workflow.status === 'polling' || workflow.status === 'wallet_pending' || workflow.status === 'submitted'
}

export function isTerminalTxWorkflow(workflow: SwapWorkflow): boolean {
  return workflow.status === 'confirmed' || workflow.status === 'confirmation_unknown' || workflow.status === 'submitted'
}

export function routeTone(workflow: SwapWorkflow): 'empty' | 'blocked' | 'ready' {
  if (workflow.status === 'failed') return 'blocked'
  if (workflow.status === 'ready_to_sign' || workflow.status === 'submitted' || workflow.status === 'confirmed' || workflow.status === 'confirmation_unknown') return 'ready'
  if (workflow.status === 'action_required') return 'ready'

  return 'empty'
}

export function txHashFromWorkflow(workflow: SwapWorkflow): Hex | null {
  switch (workflow.status) {
    case 'submitted':
    case 'confirmed':
    case 'confirmation_unknown':
      return workflow.txHash
    case 'failed':
      return workflow.txHash ?? null
    case 'idle':
    case 'submitting':
    case 'polling':
    case 'action_required':
    case 'ready_to_sign':
    case 'wallet_pending':
      return null
    default:
      return assertNever(workflow)
  }
}

export function actionMessage(swap: SwapJob): string {
  const action = swap.requiredActions.find((requiredAction) => !requiredAction.fulfilled)
  if (!action) return 'Wallet action complete'
  if (action.type === 'approval') return 'Token approval required'

  return 'Permit signature required'
}

function stageMessage(swap: SwapJob): string {
  switch (swap.stage) {
    case 'queued':
      return 'Route queued'
    case 'quoting':
      return 'Quoting route'
    case 'checking_approval':
      return 'Checking approval'
    case 'building_swap':
      return 'Building swap transaction'
    case 'awaiting_wallet_action':
      return actionMessage(swap)
    case 'ready_to_sign':
      return 'Swap transaction ready'
    case 'failed':
      return swap.error?.message ?? 'Swap failed'
    default:
      return assertNever(swap.stage)
  }
}

function failedWorkflow(action: Extract<SwapWorkflowAction, { type: 'failed' }>): SwapWorkflow {
  const workflow: SwapWorkflow = { status: 'failed', message: action.message }
  if (action.swap) workflow.swap = action.swap
  if (action.txHash) workflow.txHash = action.txHash
  return workflow
}
