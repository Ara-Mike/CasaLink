class ModalManager {
    static openModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        // Build footer with extra buttons if provided
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
        
        modal.innerHTML = `
            <div class="modal-content">
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

        // Close events
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('#modalCancel')?.addEventListener('click', () => this.closeModal(modal));
        
        // Submit event
        modal.querySelector('#modalSubmit')?.addEventListener('click', () => {
            if (options.onSubmit) {
                options.onSubmit();
            } else {
                this.closeModal(modal);
            }
        });

        // Handle extra buttons - FIXED: Use proper event listeners instead of onclick
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

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        return modal;
    }

    static closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
}
window.ModalManager = ModalManager;