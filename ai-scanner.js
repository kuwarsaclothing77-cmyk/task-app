// AI Scanner Module - Image OCR and Data Extraction
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
      const worker = await createWorker('hin'); // Hindi + English support
      
      const { data: { text } } = await worker.recognize(imgSrc);
      await worker.terminate();

      const extractedData = this.parseExtractedText(text);
      this.displayResults(extractedData);
    } catch (error) {
      console.error('OCR Error:', error);
      resultsContainer.innerHTML = `<div class="ai-loading" style="color: var(--danger);">❌ Error: ${error.message}<br><small>कृपया एक स्पष्ट तस्वीर के साथ फिर से प्रयास करें</small></div>`;
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
      other: []
    };

    const lines = text.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const trimmed = line.trim();

      // Phone numbers: 10 digits, with optional country code, dashes, spaces
      const phoneMatch = trimmed.match(/(?:\+91|0)?[\s\-]?[6-9]\d[\s\-]?\d{4}[\s\-]?\d{4}|[6-9]\d{9}/g);
      if (phoneMatch) {
        phoneMatch.forEach(p => {
          const cleaned = p.replace(/[\s\-]/g, '');
          if (!data.phones.includes(cleaned)) data.phones.push(cleaned);
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
      if (trimmed.length > 2 && /^[A-Z][a-zA-Z\s]+$/.test(trimmed) && !this.isCommonWord(trimmed)) {
        if (!data.names.includes(trimmed)) data.names.push(trimmed);
      }

      // Anything else with at least 5 characters
      if (trimmed.length > 5 && !data.other.includes(trimmed)) {
        data.other.push(trimmed);
      }
    });

    return data;
  },

  isCommonWord(word) {
    const common = ['The', 'And', 'For', 'With', 'From', 'Date', 'Time', 'Name', 'Phone', 'Address', 'Email', 'Amount', 'Total', 'Payment'];
    return common.some(w => w.toLowerCase() === word.toLowerCase());
  },

  displayResults(data) {
    const resultsContainer = document.getElementById('aiResults');
    let html = '<div class="ai-results">';
    let hasData = false;

    if (data.phones.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>📱 Mobile Numbers (${data.phones.length})</strong>
        ${data.phones.map(p => `<div style="margin:4px 0">${p} <button class="ai-quick-fill" data-type="phone" data-value="${p}" style="float:right; background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.names.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>👤 Names (${data.names.length})</strong>
        ${data.names.slice(0, 5).map(n => `<div style="margin:4px 0">${n} <button class="ai-quick-fill" data-type="name" data-value="${n}" style="float:right; background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
      </div>`;
    }

    if (data.amounts.length > 0) {
      hasData = true;
      html += `<div class="ai-result-item">
        <strong>💰 Amounts (${data.amounts.length})</strong>
        ${data.amounts.map(a => `<div style="margin:4px 0">${a} <button class="ai-quick-fill" data-type="amount" data-value="${a}" style="float:right; background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
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
        ${data.dates.map(d => `<div style="margin:4px 0">${d} <button class="ai-quick-fill" data-type="date" data-value="${d}" style="float:right; background:var(--moss); color:white; border:none; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer;">+ Add</button></div>`).join('')}
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

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: var(--moss); color: white;
      padding: 12px 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 2000; animation: slideIn 0.3s ease; font-size: 13px;
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
