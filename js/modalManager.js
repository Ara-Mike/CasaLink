// js/modalManager.js
class ModalManager {
    static openModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${options.title || 'Form'}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${options.showFooter !== false ? `
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modalCancel">Cancel</button>
                    <button class="btn btn-primary" id="modalSubmit">${options.submitText || 'Save'}</button>
                </div>
                ` : ''}
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
            }
            this.closeModal(modal);
        });

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
export { ModalManager };