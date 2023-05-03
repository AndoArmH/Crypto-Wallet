const Web3 = require('web3');
const bip39 = require('bip39');
const { Alchemy, Network } = require("alchemy-sdk");
const fetch = require('node-fetch');
const axios = require('axios');
const solanaWeb3 = require('@solana/web3.js');
const endpoint = 'https://alpha-long-pallet.solana-mainnet.discover.quiknode.pro/45fd0798b7a22da534b06d6780695cef40721fd1/';
const solanaConnection = new solanaWeb3.Connection(endpoint);
const infuraProjectId = 'be53a5827d124da1aa514ee36755c77a';
const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`));



function generateMnemonic() {
    return bip39.generateMnemonic();
  }
  //get transaction history into an array by passing address
  async function getData(toAddress) {
    const config = {
      apiKey: "zecUNVefCMDdj--04wYXMKYDftudebyz",
      network: Network.ETH_MAINNET,
    };
    const alchemy = new Alchemy(config);
  
    const data = await alchemy.core.getAssetTransfers({
      fromBlock: "0x0",
      toAddress: toAddress,
      category: ["external", "internal", "erc20", "erc721", "erc1155"],
    });
  
    const transfers = [];
  
    data.transfers.forEach(transfer => {
      const { hash, from, to, value } = transfer;
      transfers.push({ hash, from, to, value });
    });
  
    return transfers;
  }

  async function getBTCBalance(address) {
    const url = `https://blockchain.info/rawaddr/${address}?cors=true`;
  
    return fetch(url)
      .then(response => response.json())
      .then(data => {
        const finalBalance = data.final_balance;
        const bitcoin = finalBalance / 100000000;
        console.log(`The final balance for ${address} is ${bitcoin} BTC.`);
        return bitcoin;
      })
      .catch(error => console.error(error));
  }
  //get transaction history for bitcoin---------------------------------------------------
  async function getTransactions(address, transactions) {
    const url = `https://blockchain.info/rawaddr/${address}?cors=true`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
  
  
      //console.log(`The final balance for ${address} is ${bitcoin} BTC.`);
  
      //const transactions = [];
      //console.log(`Transactions:`);
      data.txs.forEach(tx => {
        const hash = tx.hash;
        tx.out.forEach(output => {
          const value = output.value / 100000000;
          const toAddress = output.addr;
          if (toAddress === address) {
            //console.log(`  Received ${value} BTC from ${tx.inputs[0].prev_out.addr}`);
            transactions.push([hash, tx.inputs[0].prev_out.addr, address, `+${value} BTC`]);
          } else if (tx.inputs[0].prev_out.addr === address) {
            transactions.push([hash, address, tx.inputs[0].prev_out.addr, `-${value} BTC`]);
            //console.log(`  Sent ${value} BTC to ${toAddress}`);
          }
        });
      });
  
      //console.log(transactions);
      return transactions;
  
    } catch (error) {
      console.error(error);
    }
  }
  
  //Get transaction history for SOLANA----------------------------------
  async function getTransactionHistory(address, transactions) {
    const pubKey = new solanaWeb3.PublicKey(address);
    let transactionList = await solanaConnection.getSignaturesForAddress(pubKey, {limit: 50});
    let signatureList = transactionList.map(transaction => transaction.signature);
    let transactionDetails = await solanaConnection.getParsedTransactions(signatureList);
  
    for (let i = 0; i < transactionDetails.length; i++) {
      const tx = transactionDetails[i];
      const message = tx.transaction.message.accountKeys;
      const fromAddress = message[0].pubkey.toBase58();
      const toAddress = message[1].pubkey.toBase58();
      const hash = transactionList[i].signature;
      
  
      const parsedObj = tx.transaction.message.instructions[0]['parsed'];
      const amount = parsedObj.info.lamports / 1000000000;
  
      if(parsedObj.info.destination === address){
        transactions.push([hash, fromAddress, toAddress, `+${amount} SOL`]);
      }else if(parsedObj.info.source === address){
        transactions.push([hash, toAddress, fromAddress, `-${amount} SOL`]);
      }
  
      
  
     
    
      // const recipient = message.accountKeys[1];
      // const amount = message.instructions[0].parsed.data.amount;
    }
  
    return transactions;
  }

  async function getFeePerByte() {
    const response = await axios.get('https://blockstream.info/api/fee-estimates');
    const feePerByte = response.data['2']; // or another fee rate, depending on your needs
    return feePerByte;
  }
  module.exports = {
    generateMnemonic,
    getData,
    getBTCBalance,
    getTransactions,
    getTransactionHistory,
    getFeePerByte,

  };