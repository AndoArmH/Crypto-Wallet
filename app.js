const button = document.getElementById("create-account-button");
const textArea = document.getElementById("generated-mnemonic");

button.addEventListener("click", function() {
  const mnemonic = bip39.generateMnemonic();
  textArea.value = mnemonic;
});


