const nativeConfirm = window.confirm.bind(window);
window.confirm = message => {
  const text = String(message || "");
  if (text.startsWith("Ștergi definitiv contul ")) {
    const account = text.replace("Ștergi definitiv contul ", "").split("?")[0];
    return nativeConfirm(`Elimini accesul pentru ${account}? Contul va fi arhivat și blocat, iar istoricul operațional va fi păstrat. Owner-ul îl poate restaura ulterior.`);
  }
  return nativeConfirm(message);
};

const messageBox = document.querySelector("#bcb-users-message");
if (messageBox) {
  const normalizeCopy = () => {
    const text = messageBox.textContent || "";
    if (text === "Contul a fost șters definitiv de Owner.") {
      messageBox.textContent = "Accesul a fost eliminat. Contul este arhivat, iar istoricul a fost păstrat.";
    } else if (text === "Cererea de ștergere a fost trimisă Owner-ului.") {
      messageBox.textContent = "Cererea de eliminare a accesului a fost trimisă Owner-ului.";
    }
  };
  new MutationObserver(normalizeCopy).observe(messageBox, { childList:true, characterData:true, subtree:true });
}
