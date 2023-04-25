const express = require('express');
const Web3 = require('web3');
const crypto = require('crypto');
const bip39 = require('bip39');
const ejs = require('ejs');
//const path = require('path');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');
const HDkey = require('hdkey');
const ethUtil = require('ethereumjs-util');
const session = require('express-session');
const ethers = require('ethers');
const HDWallet = require('ethereum-hdwallet');
const { Alchemy, Network } = require("alchemy-sdk");

const bitcoin = require('bitcoinjs-lib');
const bitcore = require("bitcore-lib");

const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);
const fetch = require('node-fetch');
const axios = require('axios');


//for BTC
// Define the network
const BTCnetwork = bitcoin.networks.bitcoin; // use networks.testnet for testnet

// Derivation path
const path = `m/49'/0'/0'/0`; // Use m/49'/1'/0'/0 for testnet






const infuraProjectId = 'be53a5827d124da1aa514ee36755c77a';
const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`));
const algorithm = 'aes-256-cbc';


// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Set up session middleware
router.use(session({
  secret: 'your-secret-key-here',
  resave: false,
  saveUninitialized: true
}));

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
// async function getData(toAddress) {
//   const config = {
//     apiKey: "zecUNVefCMDdj--04wYXMKYDftudebyz",
//     network: Network.ETH_MAINNET,
//   };
//   const alchemy = new Alchemy(config);

//   const data = await alchemy.core.getAssetTransfers({
//     fromBlock: "0x0",
//     toAddress: toAddress,
//     category: ["external", "internal", "erc20", "erc721", "erc1155"],
//   });

//   const transfers = data.transfers;


//   return transfers; // return the transfers array
// }

// Parse incoming request bodies in a middleware before your handlers
app.use(bodyParser.urlencoded({ extended: false }));


// Generate a new Ethereum wallet 
app.get('/generateWallet', (req, res) => {
  const mnemonic = generateMnemonic();
  res.render('generateWallet', { mnemonic });
});
//get balance for bitcoin-----------------------------------------------------------

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

// Define a route for the login page
app.get('/login', (req, res) => {
  console.log('inside login.get');
  res.render('login');
});


// POST /login
app.post('/login', async (req, res) => {
  // Get mnemonic phrase
  const mnemonic = req.body.mnemonic;

  //ETHEREUM PORTION------------------------------------------------------------------------------

  const hdwallet = HDWallet.fromMnemonic(mnemonic);

  console.log(`0x${hdwallet.derive(`m/44'/60'/0'/0/0`).getAddress().toString('hex')}`);
  const address = "0x" + hdwallet.derive(`m/44'/60'/0'/0/0`).getAddress().toString('hex');
  const balanceInWei = await web3.eth.getBalance(address);
  const balance = web3.utils.fromWei(balanceInWei, 'ether');
  console.log('balance is ' + balance + ' eth');

  const transactions = await getData(address);
  console.log(transactions);

  //------------------------------------------------------------------------------------------------

  //BITCOIN PORTION---------------------------------------------------------------------------------
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  let root = bip32.fromSeed(seed, BTCnetwork);

  let account = root.derivePath(path);
  let node = account.derive(0).derive(0);
  let btcAddress = bitcoin.payments.p2pkh({
    pubkey: node.publicKey,
    network: BTCnetwork,
  }).address;



  console.log(`
Wallet generated:
 - Address  : ${btcAddress},
 - Key : ${node.toWIF()}, 
 - Mnemonic : ${mnemonic}
`);

  // Make a GET request to the balance endpoint
  const BTCbalance = await getBTCBalance(btcAddress);
  console.log(BTCbalance);
  const Updatedtransactions = await getTransactions(btcAddress, transactions);
  console.log(Updatedtransactions);


  //---------------------------------------------------------------------------------------------------



  res.render('wallet', { address, btcAddress, BTCbalance, balance, Updatedtransactions });
});



app.get('/send', (req, res) => {
  res.render('sendEther');
});
// POST /sendEther
app.post('/send', async (req, res) => {
  const { toAddress, amount, mnemonic } = req.body;

  const hdwallet = HDWallet.fromMnemonic(mnemonic);
  const address = `0x${hdwallet.derive(`m/44'/60'/0'/0/0`).getAddress().toString('hex')}`;
  const privateKey = hdwallet.derive(`m/44'/60'/0'/0/0`).getPrivateKey().toString('hex');

  // Convert amount to wei
  const value = web3.utils.toWei(amount, 'ether');


  // Create transaction object
  const transaction = {
    from: address,
    to: toAddress,
    value: value,
    gas: 21000, // Add gas limit here
  };


  try {
    // Get nonce for sender's account
    const nonce = await web3.eth.getTransactionCount(address);

    // Add nonce to transaction object
    transaction.nonce = nonce;

    // Sign transaction with sender's private key
    const signedTx = await web3.eth.accounts.signTransaction(transaction, privateKey);

    // Send signed transaction to network
    const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`Transaction sent! Tx hash: ${tx.transactionHash}`);

    res.render('transactionSent', { txHash: tx.transactionHash });
  } catch (error) {
    console.error(error);
    res.render('transactionFailed');
  }
});

















//SEND FXN for BTC---------------------------------------------------------------







// POST /sendBTC
app.post('/sendBTC', async (req, res) => {
  try {
    const { toAddress, amount, mnemonic } = req.body;
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    let root = bip32.fromSeed(seed, BTCnetwork);

    let account = root.derivePath(path);
    let node = account.derive(0).derive(0);
    let btcAddress = bitcoin.payments.p2pkh({
      pubkey: node.publicKey,
      network: BTCnetwork,
    }).address;


    console.log(`
      Wallet generated:
      - Address  : ${btcAddress},
      - Key : ${node.toWIF()}, 
      - Mnemonic : ${mnemonic}
    `   );
    const privateKey = bitcoin.ECPair.fromWIF(node.toWIF(), BTCnetwork);


    const amount1 = Math.floor(amount * 100000000); // in satoshis
const feePerByte = 10; // in satoshis

// Fetch UTXOs for the Bitcoin address
const response = await axios.get(`https://blockstream.info/api/address/${btcAddress}/utxo`);
const utxos = response.data;

// Create a new transaction
const tx = new bitcoin.TransactionBuilder(BTCnetwork);
console.log("checkpoint 0");

// Add the inputs to the transaction
let totalAmountAvailable = 0;
for (const utxo of utxos) {
  tx.addInput(utxo.txid, utxo.vout);
  totalAmountAvailable += utxo.value;
}
console.log("checkpoint 1");

// Add the output to the transaction
tx.addOutput(toAddress, amount1);
console.log("checkpoint 2");

//WERE GOOD TILL HERE
// Calculate the fee and add it to the output
const fee = feePerByte * tx.buildIncomplete().virtualSize();
const change = totalAmountAvailable - amount1 - fee;
if (change > 0) {
  tx.addOutput(btcAddress, change);
}
console.log("checkpoint 3");

// Sign the transaction
for (let i = 0; i < utxos.length; i++) {
  tx.sign(i, privateKey);
}

// Broadcast the transaction
const hex = tx.build().toHex();
await axios.post('https://blockstream.info/api/tx', hex);
console.log('transaction success');
   

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


async function getFeePerByte() {
  const response = await axios.get('https://blockstream.info/api/fee-estimates');
  const feePerByte = response.data['2']; // or another fee rate, depending on your needs
  return feePerByte;
}



// Set up the transactionSent route
app.get('/transactionSent', (req, res) => {
  res.render('transactionSent');
});

// Set up the transactionFailed route
app.get('/transactionFailed', (req, res) => {
  res.render('transactionFailed');
});

//app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/login');
});



app.listen(3000, () => {
  console.log('Ethereum wallet app listening on port 3000!');
});