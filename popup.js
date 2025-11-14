chrome.storage.local.get("usage", (data) => {
    const usage = data.usage || {};

    // Convert to array
    const entries = Object.entries(usage)
        .sort((a, b) => b[1] - a[1]);

    // Display total time
    const total = entries.reduce((sum, e) => sum + e[1], 0);
    document.getElementById("today").textContent =
        "Total today: " + msToMinutes(total) + " min";

    // Display list
    const ul = document.getElementById("list");

    entries.slice(0, 5).forEach(([domain, time]) => {
        const li = document.createElement("li");
        li.textContent = `${domain} — ${msToMinutes(time)} min`;
        ul.appendChild(li);
    });
});

function msToMinutes(ms) {
    return Math.round(ms / 60000);
}
