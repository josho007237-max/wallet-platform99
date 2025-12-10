import { startQueueProcessor } from '../queue';
import { creditDeposit } from './depositCreditWorker';
import { processWithdraw } from './withdrawWorker';

startQueueProcessor({
  deposit_credit: async ({ txId }) => creditDeposit(txId),
  withdraw_process: async ({ txId }) => processWithdraw(txId)
});
