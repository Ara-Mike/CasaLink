class ModalManager {
    static openModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        // Build footer
        let footerContent = '';
        if (options.showFooter !== false) {
            let extraButtonsHTML = '';
            if (options.extraButtons && options.extraButtons.length > 0) {
                extraButtonsHTML = options.extraButtons.map((btn, index) => 
                    `<button class="${btn.className}" id="modalExtraBtn_${index}">${btn.text}</button>`
                ).join('');
            }
            
            footerContent = `
                <div class="modal-footer">
                    ${extraButtonsHTML}
                    <button class="btn btn-secondary" id="modalCancel">${options.cancelText || 'Cancel'}</button>
                    <button class="btn btn-primary" id="modalSubmit">${options.submitText || 'Save'}</button>
                </div>
            `;
        }
        
        // ⬇️ Updated modal-content with width & maxWidth
        modal.innerHTML = `
            <div class="modal-content" style="${options.width ? `width: ${options.width};` : ''} ${options.maxWidth ? `max-width: ${options.maxWidth};` : ''}">
                <div class="modal-header">
                    <h3>${options.title || 'Form'}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footerContent}
            </div>
        `;

        document.body.appendChild(modal);

        // Keep all your existing event handlers
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('#modalCancel')?.addEventListener('click', () => this.closeModal(modal));

        modal.querySelector('#modalSubmit')?.addEventListener('click', () => {
            if (options.onSubmit) options.onSubmit();
            else this.closeModal(modal);
        });

        // Extra buttons
        if (options.extraButtons && options.extraButtons.length > 0) {
            options.extraButtons.forEach((btn, index) => {
                const extraBtn = modal.querySelector(`#modalExtraBtn_${index}`);
                if (extraBtn && btn.onClick) {
                    extraBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        btn.onClick();
                    });
                }
            });
        }

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        return modal;
    }

    showTenantPaymentModal(billId) {
        // Get the bill data
        const bill = getBillById(billId);
        if (!bill) {
            showNotification('Bill not found', 'error');
            return;
        }

        // Get tenant data
        const tenant = getTenantById(bill.tenantId);
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="paymentModal">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Record Payment</h2>
                        <button class="close-btn" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="payment-info">
                            <h3>Record payment for ${tenant ? tenant.name : 'Tenant'}</h3>
                            
                            <!-- Bill Details -->
                            <div class="bill-details-section">
                                <h4>Bill Details</h4>
                                <div class="bill-detail-item">
                                    <span class="label">Amount Due:</span>
                                    <span class="value">₱${formatCurrency(bill.amount)}</span>
                                </div>
                                <div class="bill-detail-item">
                                    <span class="label">Due Date:</span>
                                    <span class="value">${formatDate(bill.dueDate)}</span>
                                </div>
                                <div class="bill-detail-item">
                                    <span class="label">Room:</span>
                                    <span class="value">${tenant ? tenant.room : 'N/A'}</span>
                                </div>
                                <div class="bill-detail-item">
                                    <span class="label">Description:</span>
                                    <span class="value">${bill.description || 'Monthly Rent'}</span>
                                </div>
                            </div>
                            
                            <!-- Payment Form -->
                            <form id="paymentForm" class="payment-form">
                                <!-- Payment Method -->
                                <div class="form-group">
                                    <label for="paymentMethod">Payment Method *</label>
                                    <select id="paymentMethod" name="paymentMethod" required>
                                        <option value="">-- Select Payment Method --</option>
                                        <option value="cash">Cash</option>
                                        <option value="gcash">GCash</option>
                                        <option value="maya">Maya</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="check">Check</option>
                                    </select>
                                </div>
                                
                                <!-- Reference Number (Conditional) -->
                                <div class="form-group" id="referenceNumberGroup" style="display: none;">
                                    <label for="referenceNumber">Reference Number</label>
                                    <input type="text" id="referenceNumber" name="referenceNumber" 
                                        placeholder="Transaction ID, receipt number, etc.">
                                    <small class="field-note">Required for GCash, Maya, and Bank Transfer</small>
                                </div>
                                
                                <!-- Payment Date -->
                                <div class="form-group">
                                    <label for="paymentDate">Payment Date *</label>
                                    <input type="date" id="paymentDate" name="paymentDate" required 
                                        value="${getCurrentDate()}">
                                </div>
                                
                                <!-- Amount Paid -->
                                <div class="form-group">
                                    <label for="amountPaid">Amount Paid *</label>
                                    <div class="currency-input">
                                        <span class="currency-symbol">₱</span>
                                        <input type="number" id="amountPaid" name="amountPaid" 
                                            min="0" step="0.01" value="${bill.amount}" required>
                                    </div>
                                    <small class="field-note">Enter the actual amount received</small>
                                </div>
                                
                                <!-- Notes -->
                                <div class="form-group">
                                    <label for="paymentNotes">Notes (Optional)</label>
                                    <textarea id="paymentNotes" name="paymentNotes" 
                                            placeholder="Additional notes about this payment" 
                                            rows="3"></textarea>
                                </div>
                                
                                <!-- Payment Instructions -->
                                <div class="payment-instructions">
                                    <p><strong>Payment Instructions:</strong></p>
                                    <p>Please note that payment submission is recorded. Your landlord will verify the payment and update the status accordingly.</p>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitTenantPayment('${billId}')">Record Payment</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listener for payment method change
        document.getElementById('paymentMethod').addEventListener('change', function() {
            toggleReferenceNumberField(this.value);
        });
        
        // Initialize reference number field visibility
        toggleReferenceNumberField(document.getElementById('paymentMethod').value);
    }

    getCurrentDate() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    toggleReferenceNumberField(paymentMethod) {
        const referenceNumberGroup = document.getElementById('referenceNumberGroup');
        const referenceNumberInput = document.getElementById('referenceNumber');
        
        if (['gcash', 'maya', 'bank_transfer'].includes(paymentMethod)) {
            referenceNumberGroup.style.display = 'block';
            referenceNumberInput.required = true;
        } else {
            referenceNumberGroup.style.display = 'none';
            referenceNumberInput.required = false;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    formatDate(dateString) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-PH', options);
}

getBillById(billId) {
    // Implementation depends on your data structure
    // This is a placeholder - replace with your actual data retrieval
    const bills = getBillsForTenant(); // Assuming you have this function
    return bills.find(bill => bill.id === billId);
}

    // Function to submit tenant payment
    async submitTenantPayment(billId) {
        const form = document.getElementById('paymentForm');
        
        // Validate form
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Get form data
        const formData = new FormData(form);
        const paymentData = {
            billId: billId,
            paymentMethod: formData.get('paymentMethod'),
            referenceNumber: formData.get('referenceNumber') || '',
            paymentDate: formData.get('paymentDate'),
            amountPaid: parseFloat(formData.get('amountPaid')),
            notes: formData.get('paymentNotes') || '',
            status: 'pending', // Payment needs landlord verification
            submittedAt: new Date().toISOString()
        };
        
        try {
            // Show loading state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            // Save payment to database
            await saveTenantPayment(paymentData);
            
            // Show success message
            showNotification('Payment submitted successfully! Your landlord will verify it shortly.', 'success');
            
            // Close modal
            closeModal();
            
            // Refresh the bills section
            refreshTenantBills();
            
        } catch (error) {
            console.error('Error submitting payment:', error);
            showNotification('Failed to submit payment. Please try again.', 'error');
            
            // Reset button state
            const submitBtn = document.querySelector('.modal-footer .btn-primary');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Record Payment';
        }
    }

    


    static closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
}
window.ModalManager = ModalManager;