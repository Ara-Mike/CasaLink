// js/sendpulseService.js - UPDATED WITH EMAILJS
class EmailService {
    static async init() {
        if (typeof emailjs !== 'undefined') {
            console.log('✅ EmailJS initialized');
            return true;
        } else {
            console.warn('❌ EmailJS not loaded');
            return false;
        }
    }

    static async sendTenantWelcomeEmail(tenantData, temporaryPassword, landlordEmail) {
        try {
            await this.init();
            
            console.log('📧 Debug - tenant email:', tenantData.email);
            
            if (!tenantData.email) {
                throw new Error('Tenant email is empty or undefined');
            }

            // UPDATED: Correct parameters for your template
            const templateParams = {
                // EmailJS requires to_email for the recipient
                to_email: tenantData.email,
                
                // Your template variables
                tenant_name: tenantData.name,
                tenant_email: tenantData.email,
                temporary_password: temporaryPassword,
                login_url: window.location.origin,
                landlord_email: landlordEmail,
                current_year: new Date().getFullYear(),
                property_name: tenantData.unitId || 'Your Property',
                monthly_rent: tenantData.monthlyRent ? `₱${parseFloat(tenantData.monthlyRent).toLocaleString()}` : 'Not specified'
            };

            console.log('📧 Final template params:', templateParams);

            const response = await emailjs.send(
                'service_tqx1lai',  // Your Service ID
                'template_i8j2rf9', // Your Template ID  
                templateParams,
                '9lGLo4WX9k1JISIEc' // Your Public Key
            );

            console.log('✅ Email sent successfully to:', tenantData.email);
            return { 
                success: true, 
                recipient: tenantData.email,
                response: response 
            };

        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return await this.fallbackManualCredentials(tenantData, temporaryPassword, landlordEmail);
        }
    }

     static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }


    static async testEmailSending() {
        try {
            await this.init();
            
            const testParams = {
                to_email: 'c4s4l1nk@gmail.com', // Use your real email for testing
                to_name: 'Casa Link',
                tenant_name: 'Casa Link',
                tenant_email: 'c4s4l1nk@gmail.com',
                temporary_password: 'test123',
                login_url: 'https://your-app-url.com'
            };

            console.log('🧪 Testing EmailJS with:', testParams);

            const response = await emailjs.send(
                'service_tqx1lai',
                'template_i8j2rf9', 
                testParams
            );

            console.log('✅ Test email sent successfully!', response);
            return { success: true, response };
            
        } catch (error) {
            console.error('❌ Test email failed:', error);
            return { success: false, error };
        }
    }

// You can call this from browser console: SendPulseService.testEmailSending()

    static async fallbackManualCredentials(tenantData, temporaryPassword, landlordEmail) {
        // Create credentials for manual sending (your existing method)
        const credentials = this.createCredentialsText(tenantData, temporaryPassword, landlordEmail);
        
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(credentials);
            
            // Show clear instructions
            const confirmed = confirm(
                `❌ Automatic email failed!\n\n` +
                `Credentials copied to clipboard instead.\n\n` +
                `Please paste and send to: ${tenantData.email}\n\n` +
                `Click OK to open your email client, or Cancel to just keep the credentials copied.`
            );
            
            if (confirmed) {
                // Open email client
                const subject = 'Your CasaLink Login Credentials';
                const body = credentials;
                window.open(`mailto:${tenantData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            }
            
        } catch (err) {
            // Final fallback - show credentials in alert
            alert(`📧 Send these credentials to ${tenantData.email}:\n\n${credentials}`);
        }

        return { 
            success: false, 
            recipient: tenantData.email,
            manual: true,
            error: 'EmailJS failed, used manual method',
            credentials: credentials
        };
    }

    static createCredentialsText(tenantData, temporaryPassword, landlordEmail) {
        return `
🏠 CASA LINK - Tenant Credentials

Welcome to CasaLink!

YOUR LOGIN CREDENTIALS:
• Name: ${tenantData.name}
• Email: ${tenantData.email}
• Temporary Password: ${temporaryPassword}
• Login URL: ${window.location.origin}

PROPERTY INFORMATION:
• Unit: ${tenantData.unitId || 'Not specified'}
• Monthly Rent: ${tenantData.monthlyRent ? `₱${parseFloat(tenantData.monthlyRent).toLocaleString()}` : 'Not specified'}

IMPORTANT INSTRUCTIONS:
1. Go to: ${window.location.origin}
2. Login with your email and temporary password above
3. You will be prompted to change your password immediately
4. After changing password, you can access your tenant dashboard

SECURITY NOTES:
• Change your password immediately after first login
• Do not share your password with anyone
• Your landlord cannot see your new password

GETTING HELP:
If you have any issues logging in, please contact your landlord:
${landlordEmail}

Thank you for using CasaLink!

---
This is an automated message from CasaLink Property Management System
        `.trim();
    }

    static async testConnection() {
        try {
            await this.init();
            return { success: true, method: 'emailjs' };
        } catch (error) {
            return { success: false, method: 'manual', error: error.message };
        }
    }
}

window.SendPulseService = EmailService;