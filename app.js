document.addEventListener('DOMContentLoaded', () => {
    const btnRead = document.getElementById('btn-read');
    const emailInput = document.getElementById('email-input');
    const mailTbody = document.getElementById('mail-tbody');
    const statusText = document.getElementById('status-text');
    const counter = document.getElementById('counter');
    const btnClearLogs = document.getElementById('btn-clear-logs');
    const logContainer = document.getElementById('log-container');

    // Modal elements
    const emailModal = document.getElementById('email-modal');
    const modalSubject = document.getElementById('modal-subject');
    const modalBodyContent = document.getElementById('modal-body-content');
    const closeModal = document.querySelector('.close-modal');

    // Store for message content to avoid breaking HTML attributes
    const messageStorage = new Map();

    function logToUI(message, type = 'info') {
        const entry = document.createElement('div');
        const now = new Date().toLocaleTimeString();
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${now}] ${message}`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function parseDate(dateStr) {
        if (!dateStr) return new Date();
        let d = new Date(dateStr);
        // Fix for formats like "2026-03-11 09:44:47"
        if (isNaN(d.getTime())) {
            d = new Date(dateStr.replace(/-/g, '/').replace('T', ' '));
        }
        return isNaN(d.getTime()) ? new Date() : d;
    }

    // TikTok Code Extractor
    function extractCode(messageContent) {
        if (!messageContent) return 'N/A';
        const codeRegex = /\b\d{6}\b/;
        const match = messageContent.match(codeRegex);
        if (match) return match[0];

        const tiktokRegex = /(\d{4,8})\s+là\s+mã\b/i;
        const ttMatch = messageContent.match(tiktokRegex);
        if (ttMatch) return ttMatch[1];

        return 'N/A';
    }

    btnClearLogs.addEventListener('click', () => {
        logContainer.innerHTML = '';
        logToUI('Logs cleared.', 'system');
    });

    closeModal.onclick = () => emailModal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == emailModal) emailModal.style.display = "none";
    }

    function openEmailDetails(subject, content) {
        modalSubject.textContent = subject || "No Subject";
        modalBodyContent.innerHTML = content || "No content";
        emailModal.style.display = "block";
    }

    // Exposed to window for the onclick handler
    window.viewFullMailById = (id) => {
        const data = messageStorage.get(id);
        if (data) {
            openEmailDetails(data.subject, data.body);
        }
    };

    btnRead.addEventListener('click', async () => {
        const input = emailInput.value.trim();
        if (!input) {
            showToast('Vui lòng nhập dữ liệu email!', 'warning');
            return;
        }

        const lines = input.split('\n');
        mailTbody.innerHTML = '';
        messageStorage.clear(); // Clear storage for new run
        let totalCount = 0;

        statusText.textContent = 'Đang thực hiện...';
        btnRead.disabled = true;
        logToUI(`Bắt đầu đọc ${lines.length} account...`, 'system');

        for (const line of lines) {
            const rawLine = line.trim();
            if (!rawLine) continue;

            const parts = rawLine.split('|');
            if (parts.length < 4) {
                logToUI(`Dòng sai định dạng: ${rawLine.substring(0, 20)}...`, 'error');
                continue;
            }

            const account = {
                email: parts[0].trim(),
                refresh_token: parts[2].trim(),
                client_id: parts[3].trim()
            };

            logToUI(`Đang lấy mail: ${account.email}`, 'info');

            try {
                const data = await fetchMail(account);

                if (data && data.status && data.messages) {
                    const sortedMsgs = data.messages.sort((a, b) => parseDate(b.date) - parseDate(a.date));
                    if (sortedMsgs.length > 0) {
                        logToUI(`Thành công ${account.email}: ${sortedMsgs.length} tin`, 'success');
                        addAccountToTable(account.email, sortedMsgs);
                        totalCount += sortedMsgs.length;
                    } else {
                        logToUI(`${account.email}: Không có tin nhắn mẫu.`, 'warning');
                        addEmptyAccountRow(account.email);
                    }
                } else {
                    const err = data ? (data.message || "Unknown error") : "API Error";
                    logToUI(`Lỗi ${account.email}: ${err}`, 'error');
                    addErrorAccountRow(account.email, err);
                }
            } catch (error) {
                logToUI(`Lỗi ${account.email}: ${error.message}`, 'error');
                addErrorAccountRow(account.email, error.message);
            }
        }

        btnRead.disabled = false;
        statusText.textContent = 'Hoàn thành';
        counter.textContent = `Số lượng: ${totalCount}`;
    });

    async function fetchMail(account) {
        const response = await fetch('/api_proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: account.email,
                refresh_token: account.refresh_token,
                client_id: account.client_id
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    function addAccountToTable(email, messages) {
        const groupId = 'group-' + Math.random().toString(36).substr(2, 6);

        createRow(email, messages[0], 1, false, groupId);

        if (messages.length > 1) {
            const seeMoreTr = document.createElement('tr');
            seeMoreTr.className = `see-more-row ${groupId}`;
            seeMoreTr.innerHTML = `
                <td colspan="6" class="see-more-btn">
                    <i class="fas fa-chevron-down"></i> Xem thêm (${messages.length - 1} tin nhắn cũ)...
                </td>
            `;
            seeMoreTr.onclick = () => {
                const extras = document.querySelectorAll(`.${groupId}.extra-row`);
                if (extras.length === 0) return;
                const isHidden = extras[0].classList.contains('hidden');
                extras.forEach(r => isHidden ? r.classList.remove('hidden') : r.classList.add('hidden'));
                seeMoreTr.innerHTML = isHidden ?
                    `<i class="fas fa-chevron-up"></i> Thu gọn` :
                    `<i class="fas fa-chevron-down"></i> Xem thêm (${messages.length - 1} tin nhắn cũ)...`;
            };
            mailTbody.appendChild(seeMoreTr);

            for (let i = 1; i < messages.length; i++) {
                createRow(email, messages[i], i + 1, true, groupId);
            }
        }

        const div = document.createElement('tr');
        div.className = 'account-divider';
        div.innerHTML = '<td colspan="6"></td>';
        mailTbody.appendChild(div);
    }

    function createRow(email, msg, stt, isHidden, groupId) {
        const tr = document.createElement('tr');
        tr.className = isHidden ? `extra-row hidden ${groupId}` : `main-row ${groupId}`;

        const date = parseDate(msg.date);
        const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' +
            date.toLocaleDateString('vi-VN');

        let fromText = 'Unknown';
        if (msg.from) {
            if (Array.isArray(msg.from)) fromText = msg.from[0]?.address || msg.from[0]?.name || 'Unknown';
            else fromText = msg.from.address || msg.from.name || msg.from;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = msg.message || "";
        const cleanContent = tempDiv.textContent || tempDiv.innerText || "";

        const extractedCode = msg.code || extractCode(cleanContent);

        // Store message content safely to be viewed later
        const msgId = 'msg-' + Math.random().toString(36).substr(2, 9);
        messageStorage.set(msgId, { subject: msg.subject, body: msg.message });

        tr.innerHTML = `
            <td class="email-cell">${email}</td>
            <td class="stt-cell" style="text-align:center;">${stt}</td>
            <td class="from-cell">${fromText}</td>
            <td class="time-cell">${timeStr}</td>
            <td class="content-cell">
                <div class="message-preview-container">
                    <div class="message-preview"><strong>${msg.subject || 'No Subject'}</strong> - ${cleanContent.substring(0, 200)}</div>
                    <div class="chi-tiet-link" onclick="viewFullMailById('${msgId}')">Chi tiết >></div>
                </div>
            </td>
            <td class="code-cell" style="text-align:center;">
                <span class="code-value">${extractedCode}</span>
                <div class="copy-badge" onclick="copyToClipboard('${extractedCode}')">Copy</div>
            </td>
        `;
        mailTbody.appendChild(tr);
    }

    function addEmptyAccountRow(email) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="email-cell">${email}</td><td colspan="5" style="text-align:center; color:gray;">Không tìm thấy tin nhắn nào</td>`;
        mailTbody.appendChild(tr);
    }

    function addErrorAccountRow(email, err) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="email-cell">${email}</td><td colspan="5" style="text-align:center; color:red;">Lỗi: ${err}</td>`;
        mailTbody.appendChild(tr);
    }

    window.copyToClipboard = (text) => {
        if (!text || text === 'N/A') return;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Đã copy: ' + text, 'success');
        });
    };

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
});
