const express = require('express');
const Web3 = require('web3');
const crypto = require('crypto');
const bip39 = require('bip39');
const ejs = require('ejs');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');

const infuraProjectId = 'be53a5827d124da1aa514ee36755c77a';
const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`));

let privateKeyEncrypted;
//const encryptionPassword = 'mysecretpassword';

// Set up EJS as the view engine
app.set('view engine', 'ejs');

function generateMnemonic() {
  return bip39.generateMnemonic();
}

// Define a middleware function to check if the user is logged in
const isLoggedIn = (req, res, next) => {
  // Check if the user's session contains a logged-in flag
  if (req.session.loggedIn) {
    next();
  } else {
    // If not logged in, redirect to login page
    res.redirect('/login');
  }
};

// Parse incoming request bodies in a middleware before your handlers
app.use(bodyParser.urlencoded({ extended: false }));

// Encrypt the private key using AES-256-CBC encryption
/*function encryptPrivateKey(privateKey, password) {
  const salt = crypto.randomBytes(32);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encryptedPrivateKey = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  const result = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    encryptedPrivateKey: encryptedPrivateKey.toString('hex')
  };
  return result;
}*/

// Decrypt the private key using AES-256-CBC decryption
/*const decryptPrivateKey = (privateKeyEncrypted) => {
  const algorithm = 'aes-256-cbc';
  const password = encryptionPassword;

  const [iv, encrypted] = privateKeyEncrypted.split(':').map(part => Buffer.from(part, 'hex'));
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(password), iv);
  const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');

  return decrypted.toString();
};*/

// Generate a new Ethereum wallet and encrypt the private key
app.get('/generateWallet', (req, res) => {
  //const newAccount = web3.eth.accounts.create();
  //privateKeyEncrypted = encryptPrivateKey(newAccount.privateKey);
  //const privateKey = newAccount.privateKey;
  //const mnemonic = newAccount.mnemonic;
  //console.log(newAccount.mnemonic);
  //res.send({ address: newAccount.address,  mnemonic });
  const mnemonic = generateMnemonic();
  const newAccount = web3.eth.accounts.create(mnemonic);
  //res.send({ address: newAccount.address,  mnemonic });
  res.render(path.join(__dirname, 'generateWallet.ejs'), { mnemonic });
});
// Define a route for the login page
app.get('/login', (req, res) => {
  console.log('inside login.get');
  res.render('login');
});

// Handle POST request to /login route
app.post('/login', (req, res) => {
  const mnemonic = req.body.mnemonic;

  // Verify that the mnemonic phrase is valid
  if (!bip39.validateMnemonic(mnemonic)) {
    res.render('login', { error: 'Invalid mnemonic phrase' });
    return;
  }

  // Verify that an account exists for the given mnemonic phrase
  const wallet = web3.eth.accounts.wallet;
  let accountExists = false;
  for (let i = 0; i < wallet.length; i++) {
    const account = wallet[i];
    if (account.mnemonic === mnemonic) {
      accountExists = true;
      break;
    }
  }

  if (accountExists) {
    // Set the logged-in flag in the user's session
    req.session.loggedIn = true;
    console.log(" account found for mnemonic phrase");
    res.redirect('/');
  } else {
    console.log("No account found for mnemonic phrase");
    res.render('login', { error: 'No account found for mnemonic phrase' });

  }
});

// Send Ethereum from the wallet to a specified address
app.get('/sendEther',(req, res) => {
  const fromAddress = req.query.fromAddress;
  const toAddress = req.query.toAddress;
  const amountInWei = web3.utils.toWei(req.query.amount, 'ether');

  const privateKey = decryptPrivateKey(privateKeyEncrypted);
  const fromAccount = web3.eth.accounts.privateKeyToAccount(privateKey);

  web3.eth.sendTransaction({ from: fromAddress, to: toAddress, value: amountInWei })
    .then(transactionHash => res.send({ transactionHash }))
    .catch(error => res.send({ error: error.message }));
});

// Receive Ethereum in the wallet
app.get('/receiveEther',(req, res) => {
  const fromAddress = req.query.fromAddress;
  const amountInWei = web3.utils.toWei(req.query.amount, 'ether');

  const privateKey = decryptPrivateKey(privateKeyEncrypted);
  const toAccount = web3.eth.accounts.privateKeyToAccount(privateKey);

  web3.eth.sendTransaction({ from: fromAddress, to: toAccount.address, value: amountInWei })
    .then(transactionHash => res.send({ transactionHash }))
    .catch(error => res.send({ error: error.message }));
});

app.get('/signTransaction', (req, res) => {
  const toAddress = req.query.toAddress;
  const amountInWei = web3.utils.toWei(req.query.amount, 'ether');

  const privateKey = decryptPrivateKey(privateKeyEncrypted);
  const fromAccount = web3.eth.accounts.privateKeyToAccount(privateKey);

  // Create the raw transaction data
  const rawTransaction = {
    from: fromAccount.address,
    to: toAddress,
    value: amountInWei,
    gasPrice: web3.utils.toHex(web3.eth.gasPrice),
    gasLimit: web3.utils.toHex(21000),
    nonce: web3.utils.toHex(web3.eth.getTransactionCount(fromAccount.address))
  };

  // Sign the transaction
  const signedTransaction = web3.eth.accounts.signTransaction(rawTransaction, privateKey);

  // Send the signed transaction
  web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
    .then(transactionHash => res.send({ transactionHash }))
    .catch(error => res.send({ error: error.message }));
});

app.use(express.static('public'));

app.get('/', isLoggedIn,(req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});



app.listen(3000, () => {
  console.log('Ethereum wallet app listening on port 3000!');
});