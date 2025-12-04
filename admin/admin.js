async function load() {
    const data = await fetch("/api/messages").then(r => r.json());
    let html = "";
    data.forEach(m => {
        html += `<p><b>${m.phone}</b> [${m.direction}] : ${m.content}</p>`;
    });
    document.getElementById("messages").innerHTML = html;
}
load();

async function sendMsg() {
    const phone = document.getElementById("phone").value;
    const text = document.getElementById("text").value;

    await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text })
    });

    alert("Message Sent!");
    load();
}