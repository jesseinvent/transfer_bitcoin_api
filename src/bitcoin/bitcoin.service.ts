import { HttpService } from '@nestjs/axios';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as Bitcore from 'bitcore-lib';
import { firstValueFrom } from 'rxjs';
import { SendBitcoin } from './interfaces/sendBitcoin.interface';
import { UnspentTransactionOutput } from './interfaces/UnSpendtransaction.interface';

@Injectable()
/**
 * @recieverAddress - Address of the person you want
 * to send bitcoin to
 *
 * @bitcoinToSend - The amount of bitcoin you want to send to someone from your wallet.
 * This amount will be deducted from your wallet and sent to this address
 */
export class BitcoinService {
  private SATOSHI = 100000000;

  constructor(private httpService: HttpService) {}
  async sendBitcoin({
    senderAddress,
    senderPrivateKey,
    recieverAddress,
    bitcoinToSend,
  }: SendBitcoin) {
    const sochain_network = 'BTCTEST';
    const privateKey = senderPrivateKey;

    const satoshiToSend = bitcoinToSend * this.SATOSHI;
    let fee = 0;
    let inputCount = 0;
    const outputCount = 2; // OutputCount of 2 because we will sending to two addresses
    // receiver's address and change address

    const utxos = await this.fetchUnSpentTransactionOutputs(
      senderAddress,
      sochain_network,
    );

    // Initialise new Bitcoin Transaction
    const transaction = new Bitcore.Transaction();

    const transactionInputsResult =
      this.buildNewInputsFromUnspentOutputs(utxos);

    transaction.from(transactionInputsResult.inputs);

    inputCount = transactionInputsResult.inputCount;

    /**
     * Check if you have enough funds to cover the transaction
     * Paying 20 Satoshi per byte
     * */
    fee = this.calculateTotalTransactionFee({
      inputCount,
      outputCount,
      satoshisToPayPerByte: 20,
    });

    const amountIsSufficient = this.verifyAvailableTransactionAmount({
      totalAmountAvailable: transactionInputsResult.totalAmountAvailable,
      satoshiToSend,
      fee,
    });

    console.log(`BitcoinAmountIsSufficient: ${amountIsSufficient}`);

    if (!amountIsSufficient) {
      throw new UnprocessableEntityException(
        'Balance too low for transactionu',
      );
    }

    // Set transaction input
    transaction.from(transactionInputsResult.inputs);

    // Set recieving address and amount to send
    transaction.to(recieverAddress, satoshiToSend);

    /**
     * Setting up change address:
     *
     * You can't only send part of your bitcoin out to another address.
     * You take out everything and send the  amount you want to the
     * receiving address, and send back the change to yourself.
     *
     * So, the change address is the sender's address - The address to
     * get the balance paid into after sending to the receiver.
     */

    transaction.change(senderAddress);

    /**
     * Set transaction fee
     */
    transaction.fee(fee);

    /**
     * Signing the transaction:
     *
     * To spend bitcoin in a wallet, we must have the private key of
     * that wallet. Private key is the password to unlock
     * the funds in any bitcoin wallet
     */

    transaction.sign(privateKey);

    /**
     * Serialize bitcoin transaction:
     *
     * To broadcast the transaction, we need to serialize the transaction
     * in order to get the transaction hex.
     *
     * The transaction will be broadcast to the blockchain
     */

    const serializedTransaction = transaction.serialize();

    /**
     * Broadcast transaction to the Blockchain
     */
    const result = await this.broadCastTransaction(
      serializedTransaction,
      sochain_network,
    );

    console.log(result);

    return result;
  }

  private async fetchUnSpentTransactionOutputs(
    address: string,
    network: string,
  ): Promise<any> {
    try {
      /**
       * Unspent transaction amount outputs (UTXO):
       *
       * Transactions you received to your Bitcoin wallet that have not been spent
       * Whenever a user recieved a bitcoin, that amount is recorded within
       * the Blockchain as a UTXO.
       * A user's bitcoin balance is derived by scannin the blockchain and
       * aggregating all UTXO belonging to that user.
       *
       * TIP: There are no accounts or balances in bitcoin;
       * There are only unspent transaction outputs (UTXO) scattered
       * in the Blockchain
       */

      console.log('Fetching UTXOs...');

      const endpoint = `https://sochain.com/api/v2/get_tx_unspent/${network}/${address}`;

      const response = await firstValueFrom(this.httpService.get(endpoint));

      return response.data.data;
    } catch (error) {
      console.log(error.response);
    }
  }

  private buildNewInputsFromUnspentOutputs(utxos) {
    /**
     * Building new inputs from unspents outputs
     *
     * Details:
     *
     * Satoshis: The value of unspent output is satoshi
     * Script: Instruction defininf how to spend the unspent output
     * Address: Your wallet address
     * Transaction ID (txid): Unique ID to identify transaction in the blockchain
     * OutputIndex: Index of eact output in a transaction
     */

    console.log('Building Inputs from UTXOs...');

    let totalAmountAvailable = 0;
    let inputCount = 0;

    const inputs = [];

    const unspentTransactionOutputs =
      utxos.txs as Array<UnspentTransactionOutput>;

    unspentTransactionOutputs.forEach(
      (transaction: UnspentTransactionOutput) => {
        const utxo: any = {};

        const valueInSatoshi = transaction.value * this.SATOSHI;

        utxo['satoshis'] = valueInSatoshi;
        utxo['script'] = transaction.script_hex;
        utxo['address'] = utxos.address;
        utxo['txId'] = transaction.txid;
        utxo['outputIndex'] = transaction.output_no;

        totalAmountAvailable += valueInSatoshi;
        inputCount++;
        inputs.push(utxo);
      },
    );

    return { inputs, totalAmountAvailable, inputCount };
  }

  private verifyAvailableTransactionAmount({
    totalAmountAvailable,
    satoshiToSend,
    fee,
  }: {
    totalAmountAvailable: number;
    satoshiToSend: number;
    fee: number;
  }) {
    const result = satoshiToSend + fee < totalAmountAvailable; // Bitcoin amount is sufficient

    return result;
  }

  private calculateTotalTransactionFee({
    inputCount,
    outputCount,
    satoshisToPayPerByte,
  }: {
    inputCount: number;
    outputCount: number;
    satoshisToPayPerByte: number;
  }) {
    /**
     * Bitcoin Transaction fees doesn't depend on the amount
     * of bitcoin you are sending, but on the size of the transaction.
     * You need to first determine the size of the transaction.
     * The size of the transaction depends on the input and output in
     * the transaction.
     */
    /**
     * In every Bitcoin transaction, the inpus contribute 180 bytes each
     * to the transaction, while output contribute 34 bytes each to the
     * transaction.
     */
    /**
     * Formular for calculating fees:
     *
     * transactionSize = (inputCount * 180) + (outputCount * 34) + 10 - inputCount
     * fee = transactionSize/this.SATOSHI
     */

    console.log('Calculating transaction mining fee...');

    const transactionSize =
      inputCount * 180 + outputCount * 34 + 10 - inputCount;

    const fee = transactionSize * satoshisToPayPerByte;
    // const convertFeeToSatoshi = fee / this.SATOSHI;

    return fee;
  }

  private async broadCastTransaction(
    serializedTransactionHex: string,
    sochain_network: string,
  ): Promise<any> {
    console.log('Broadcasting transaction to Blockchain...');

    const endpoint = `https://sochain.com/api/v2/send_tx/${sochain_network}`;
    const result = await firstValueFrom(
      this.httpService.post(endpoint, {
        tx_hex: serializedTransactionHex,
      }),
    );

    return result.data.data;
  }
}
