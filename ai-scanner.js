// AI Scanner Module - Image OCR and Data Extraction with Auto-Fill & Export
// Uses Tesseract.js for offline OCR (no API required)

const AiScanner = {
  currentScannedData: null,
  currentTargetSection: null,

  init() {
    this.setupEventListeners();
    this.loadTesseractScript();
  },

  setupEventListeners() {
    const aiScanBtn = document.getElementById('aiScanBtn');
    const aiModalClose = document.getElementById('aiModalClose');
    const aiModal = document.getElementById('aiModal');
    const aiUploadArea = document.getElementById('aiUploadArea');
    const aiImageInput = document.getElementById('aiImageInput');

    aiScanBtn?.addEventListener('click', () => this.openModal());
    aiModalClose?.addEventListener('click', () => this.closeModal());
    aiModal?.addEventListener('click', (e) => {
      if (e.target === aiModal) this.closeModal();
    });

    aiUploadArea?.addEventListener('click', () => aiImageInput?.click());
    aiUploadArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      aiUploadArea.classList.add('dragover');
    });
    aiUploadArea?.addEventListener('dragleave', () => {
      aiUploadArea.classList.remove('dragover');
    });
    aiUploadArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      aiUploadArea.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        this.handleImageSelect(e.dataTransfer.files[0]);
      }
    });

    aiImageInput?.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.handleImageSelect(e.target.files[0]);
      }
    });
  },

  openModal() {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.remove('active');
    document.getElementById('aiPreview').innerHTML = '';
    document.getElementById('aiResults').innerHTML = '';
  },

  loadTesseractScript() {
    // Load Tesseract.js library from CDN
    if (!window.Tesseract) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => console.log('Tesseract.js loaded');
      document.head.appendChild(script);
    }
  },

  handleImageSelect(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Image size must be less than 4MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target.result;
      this.displayPreview(imgSrc);
      this.performOCR(imgSrc);
    };
    reader.readAsDataURL(file);
  },

  displayPreview(imgSrc) {
    const previewContainer = document.getElementById('aiPreview');
    previewContainer.innerHTML = `<img src="${imgSrc}" class="ai-preview" alt="Preview">`;
  },

  async performOCR(imgSrc) {
    const resultsContainer = document.getElementById('aiResults');
    resultsContainer.innerHTML = '<div class="ai-loading">🔍 Scanning image... (यह कुछ सेकंड ले सकता है)</div>';

    try {
      if (!window.Tesseract) {
        resultsContainer.innerHTML = '<div class="ai-loading">⚠️ Tesseract library loading... कृपया थोड़ा प्रतीक्षा करें</div>';
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!window.Tesseract) throw new Error('OCR library not loaded');
      }

      const { createWorker } = window.Tesseract;
      const worker = await createWorker('eng'); // English + auto-detect
      
      const { data: { text } } = await worker.recognize(imgSrc);
      await worker.terminate();

      const extractedData = this.parseExtractedText(text);
      this.displayResults(extractedData);
    } catch (error) {
      console.error('OCR Error:', error);
      resultsContainer.innerHTML = `<div class="ai-loading" style="color: var(--danger);">❌ Error: ${error.message}<br><small>कृपया एक स्पष्ट तस्वीर के साथ पुन: प्रयास करें</small></div>`;
    }
  },

  parseExtractedText(text) {
    const data = {
      phones: [],
      emails: [],
      names: [],
      addresses: [],
      amounts: [],
      dates: [],
      other: [],
      rawText: text
    };

    const lines = text.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const trimmed = line.trim();

      // Phone numbers: 10 digits, with optional country code, dashes, spaces
      const phoneMatch = trimmed.match(/(?:\+91|0)?[\s\-]?[6-9]\d[\s\-]?\d{4}[\s\-]?\d{4}|[6-9]\d{9}/g);
      if (phoneMatch) {
        phoneMatch.forEach(p => {
          const cleaned = p.replace(/[\s\-]/g, '');
          if (cleaned.length === 10 && !data.phones.includes(cleaned)) {
            data.phones.push(cleaned);
          }
        });
      }

      // Emails
      const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatch) {
        emailMatch.forEach(e => {
          if (!data.emails.includes(e)) data.emails.push(e);
        });
      }

      // Amounts/Numbers with ₹, Rs, rupees
      const amountMatch = trimmed.match(/(?:₹|Rs\.?|rupees)\s*[\d,]+(?:\.\d{2})?/gi);
      if (amountMatch) {
        amountMatch.forEach(a => {
          if (!data.amounts.includes(a)) data.amounts.push(a);
        });
      }

      // Dates (various formats)
      const dateMatch = trimmed.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{4}/gi);
      if (dateMatch) {
        dateMatch.forEach(d => {
          if (!data.dates.includes(d)) data.dates.push(d);
        });
      }

      // Names (capitalized words, 2+ characters, excluding common words)
      if (trimmed.length > 2 && trimmed.length < 50 && /^[A-Z][a-zA-Z\s]+$/.test(trimmed) && !this.isCommonWord(trimmed)) {
        if (!data.names.includes(trimmed)) data.names.push(trimmed);
      }

      // Addresses and longer text
      if (trimmed.length > 10 && trimmed.length < 100 && !data.addresses.includes(trimmed) && !data.other.includes(trimmed)) {
        data.addresses.push(trimmed);
      }
    });

    return data;
  },

  isCommonWord(word) {
    const common = ['The', 'And', 'For', 'With', 'From', 'Date', 'Time', 'Name', 'Phone', 'Address', 'Email', 'Amount', 'Total', 'Payment', 'Mobile', 'Number', 'Contact', 'Person'];
    return common.some(w => w.toLowerCase() === word.toLowerCase());
  },

  displayResults(data) {
    const resultsContainer = document.getElementById('aiResults');
    let html = '<div class="ai-results">';
    let hasData = false;

    // Export Buttons
    html += `<div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
      <button id="aiExportJson" style="background: var(--moss); color: white; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">📥 Export JSON</button>
      <button id="aiExportCsv" style="background: var(--clay); color: white; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">📊 Export CSV</button>
      <button id="aiAutoFillAll" style="background: var(--moss-dark); color: white; border: none; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">⚡ Auto-Fill All</button>
    </div>`;

    if (data.phones.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>📱 Mobile Numbers (${data.phones.length})</strong>
        ${data.phones.slice(0, 10).map(p => `<div style="margin:4px 0; display: flex; justify-content: space-between; align-items: center;"><span>${p}</span><button class="ai-quick-fill" data-type="phone" data-value="${p}" style="background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.names.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>👤 Names (${data.names.length})</strong>
        ${data.names.slice(0, 5).map(n => `<div style="margin:4px 0; display: flex; justify-content: space-between; align-items: center;"><span>${n}</span><button class="ai-quick-fill" data-type="name" data-value="${n}" style="background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.amounts.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>💰 Amounts (${data.amounts.length})</strong>
        ${data.amounts.map(a => `<div style="margin:4px 0; display: flex; justify-content: space-between; align-items: center;"><span>${a}</span><button class="ai-quick-fill" data-type="amount" data-value="${a}" style="background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.emails.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>📧 Emails (${data.emails.length})</strong>
        ${data.emails.map(e => `<div style="margin:4px 0">${e}</div>`).join('')}
      </div>`;
    }

    if (data.dates.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>📅 Dates (${data.dates.length})</strong>
        ${data.dates.slice(0, 5).map(d => `<div style="margin:4px 0; display: flex; justify-content: space-between; align-items: center;"><span>${d}</span><button class="ai-quick-fill" data-type="date" data-value="${d}" style="background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.addresses.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>📍 Addresses (${data.addresses.length})</strong>
        ${data.addresses.slice(0, 3).map(a => `<div style="margin:4px 0; font-size: 12px; color: var(--muted);">${a}</div>`).join('')}
      </div>`;
    }

    if (!hasData) {
      html += '<div class="ai-loading">❌ कोई डेटा नहीं मिला। कृपया एक स्पष्ट छवि के साथ पुन: प्रयास करें</div>';
    }

    html += '</div>';
    resultsContainer.innerHTML = html;

    // Attach event listeners to quick-fill buttons
    document.querySelectorAll('.ai-quick-fill').forEach(btn => {
      btn.addEventListener('click', (e) => this.quickFillField(e));
    });

    // Export buttons
    document.getElementById('aiExportJson')?.addEventListener('click', () => this.exportData('json', data));
    document.getElementById('aiExportCsv')?.addEventListener('click', () => this.exportData('csv', data));
    document.getElementById('aiAutoFillAll')?.addEventListener('click', () => this.autoFillAllFields(data));

    this.currentScannedData = data;
  },

  quickFillField(e) {
    const type = e.target.dataset.type;
    const value = e.target.dataset.value;
    const activeSection = document.querySelector('.section-btn.active')?.dataset.s;

    if (type === 'phone' && activeSection === 'tasks') {
      document.getElementById('phoneInput').value = value.replace(/[\s\-]/g, '');
      this.showNotification(`✅ Phone number filled in Tasks`);
    } else if (type === 'name' && activeSection === 'tasks') {
      document.getElementById('nameInput').value = value;
      this.showNotification(`✅ Name filled in Tasks`);
    } else if (type === 'phone' && activeSection === 'hotlist') {
      document.getElementById('hl-phone').value = value.replace(/[\s\-]/g, '');
      this.showNotification(`✅ Phone number filled in Hot List`);
    } else if (type === 'name' && activeSection === 'hotlist') {
      document.getElementById('hl-name').value = value;
      this.showNotification(`✅ Name filled in Hot List`);
    } else if (type === 'phone' && activeSection === 'friends') {
      document.getElementById('fr-phone').value = value.replace(/[\s\-]/g, '');
      this.showNotification(`✅ Phone number filled in Friends`);
    } else if (type === 'name' && activeSection === 'friends') {
      document.getElementById('fr-name').value = value;
      this.showNotification(`✅ Name filled in Friends`);
    } else if (type === 'amount' && activeSection === 'sitevisits') {
      document.getElementById('sv-token').value = value;
      this.showNotification(`✅ Amount filled in Site Visits`);
    } else if (type === 'phone' && activeSection === 'sitevisits') {
      // Find first empty visitor phone field
      for (let i = 1; i <= 4; i++) {
        const field = document.getElementById(`sv-phone${i}`);
        if (!field.value) {
          field.value = value.replace(/[\s\-]/g, '');
          this.showNotification(`✅ Visitor ${i} phone filled`);
          return;
        }
      }
    } else {
      this.showNotification(`⚠️ कृपया ${activeSection} section में डेटा भरने के लिए उपयुक्त क्षेत्र चुनें`);
    }
  },

  autoFillAllFields(data) {
    let filledCount = 0;

    // Auto-fill Hot List first
    if (data.names.length > 0 && data.phones.length > 0) {
      document.getElementById('hl-name').value = data.names[0];
      document.getElementById('hl-phone').value = data.phones[0].replace(/[\s\-]/g, '');
      filledCount += 2;
    }

    // Auto-fill Friends if multiple names/phones
    if (data.names.length > 1 && data.phones.length > 1) {
      document.getElementById('fr-name').value = data.names[1];
      document.getElementById('fr-phone').value = data.phones[1].replace(/[\s\-]/g, '');
      filledCount += 2;
    }

    // Auto-fill Site Visits with amounts and visitor info
    if (data.phones.length > 0 && data.names.length > 0) {
      document.getElementById('sv-name1').value = data.names[0];
      document.getElementById('sv-phone1').value = data.phones[0].replace(/[\s\-]/g, '');
      
      if (data.amounts.length > 0) {
        document.getElementById('sv-token').value = data.amounts[0];
      }
      filledCount += 3;
    }

    if (filledCount > 0) {
      this.showNotification(`⚡ Auto-filled ${filledCount} fields across sections!`);
    } else {
      this.showNotification(`⚠️ Not enough data to auto-fill`);
    }
  },

  exportData(format, data) {
    if (format === 'json') {
      const jsonData = {
        exportDate: new Date().toISOString(),
        phones: data.phones,
        names: data.names,
        emails: data.emails,
        amounts: data.amounts,
        dates: data.dates,
        addresses: data.addresses,
        rawText: data.rawText
      };

      const dataStr = JSON.stringify(jsonData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-scan-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showNotification('📥 JSON file downloaded!');
    } else if (format === 'csv') {
      let csv = 'Type,Value,Count\n';
      csv += `Phones,${data.phones.join('; ')},${data.phones.length}\n`;
      csv += `Names,${data.names.join('; ')},${data.names.length}\n`;
      csv += `Emails,${data.emails.join('; ')},${data.emails.length}\n`;
      csv += `Amounts,${data.amounts.join('; ')},${data.amounts.length}\n`;
      csv += `Dates,${data.dates.join('; ')},${data.dates.length}\n`;
      csv += `Addresses,${data.addresses.join('; ')},${data.addresses.length}\n`;

      const csvBlob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-scan-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      this.showNotification('📊 CSV file downloaded!');
    }
  },

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: var(--moss); color: white;
      padding: 12px 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 2000; animation: slideIn 0.3s ease; font-size: 13px; max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }
};

// Add animation styles
if (!document.getElementById('aiScannerStyles')) {
  const style = document.createElement('style');
  style.id = 'aiScannerStyles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => AiScanner.init());
