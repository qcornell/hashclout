// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
    // Connect wallet button functionality
    const connectWalletButton = document.querySelector('.connect-wallet-button');
    
    if (connectWalletButton) {
        connectWalletButton.addEventListener('click', function() {
            openWalletConnectModal();
        });
    }
    
    // Primary hero button click handler - Projects Gaining Clout
    const primaryButton = document.querySelector('.primary-button');
    if (primaryButton) {
        primaryButton.addEventListener('click', function() {
            window.location.href = 'projects.html';
        });
    }

    // Secondary hero button click handler - Post Your Project
    const secondaryButton = document.querySelector('.secondary-button');
    if (secondaryButton) {
        secondaryButton.addEventListener('click', function() {
            window.location.href = 'post-project.html';
        });
    }

    // Leaderboard view button
    const viewAllButton = document.querySelector('.view-all');
    if (viewAllButton) {
        viewAllButton.addEventListener('click', function() {
            window.location.href = 'leaderboard.html';
        });
    }
    

    // Champion tile click handler
    const championTiles = document.querySelectorAll('.champion-tile');
    championTiles.forEach(tile => {
        tile.addEventListener('click', function() {
            const championName = this.querySelector('.champion-name').textContent;
            window.location.href = `profile.html?name=${encodeURIComponent(championName)}`;
        });
    });
    
    // User menu dropdown
    const userMenuButton = document.getElementById('userMenuButton');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    
    if (userMenuButton && userMenuDropdown) {
        userMenuButton.addEventListener('click', function() {
            userMenuDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!userMenuButton.contains(event.target) && !userMenuDropdown.contains(event.target)) {
                userMenuDropdown.classList.remove('show');
            }
        });
    }

    // Login Button
    const loginButton = document.querySelector('.login-button');
    if (loginButton) {
        loginButton.addEventListener('click', function() {
            openAuthModal('login');
        });
    }

    // Close modals if clicking outside
    const authModalOverlay = document.getElementById('authModalOverlay');
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAuthModal();
            }
        });
    }
    
    const loginModalOverlay = document.getElementById('loginModalOverlay');
    if (loginModalOverlay) {
        loginModalOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeLoginModal();
            }
        });
    }

    // Handle profile image upload
    const avatarUpload = document.getElementById('avatarUpload');
    const fileInput = document.getElementById('profileImageUpload');
    
    if (avatarUpload && fileInput) {
        avatarUpload.addEventListener('click', function() {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    avatarUpload.style.backgroundImage = `url(${e.target.result})`;
                    avatarUpload.classList.add('has-image');
                }
                
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});

// Wallet Connection Modal Functions
function openWalletConnectModal() {
    const authModalOverlay = document.getElementById('authModalOverlay');
    const connectWalletStep = document.getElementById('connectWalletStep');
    const connectingState = document.getElementById('connectingState');
    const accountSetupStep = document.getElementById('accountSetupStep');
    
    if (authModalOverlay) {
        authModalOverlay.style.display = 'flex';
    }
    
    if (connectWalletStep) {
        connectWalletStep.style.display = 'block';
    }
    
    if (connectingState) {
        connectingState.style.display = 'none';
    }
    
    if (accountSetupStep) {
        accountSetupStep.style.display = 'none';
    }
}

function closeAuthModal() {
    const authModalOverlay = document.getElementById('authModalOverlay');
    if (authModalOverlay) {
        authModalOverlay.style.display = 'none';
    }
}

function connectWallet(walletType) {
    const connectWalletStep = document.getElementById('connectWalletStep');
    const connectingState = document.getElementById('connectingState');
    const accountSetupStep = document.getElementById('accountSetupStep');
    
    // Show connecting state
    if (connectWalletStep) {
        connectWalletStep.style.display = 'none';
    }
    
    if (connectingState) {
        connectingState.classList.add('active');
    }
    
    // Integrate with Hedera SDK
    // For now we'll simulate with a timeout
    setTimeout(() => {
        if (connectingState) {
            connectingState.classList.remove('active');
        }
        
        // Call checkUserExists() to verify if the user is registered
        // For now, randomly determine if new user for demo
        const isNewUser = Math.random() > 0.5;
        
        if (isNewUser && accountSetupStep) {
            // For new users, show the profile setup step
            accountSetupStep.style.display = 'block';
        } else {
            // For existing users, close the modal and redirect/show dashboard
            closeAuthModal();
            
            // Here you would redirect to dashboard or refresh the current page
            alert("Welcome back! You're now connected with Hedera."); // Replace with redirect in real implementation
        }
    }, 1500); // Simulate connection delay
}

function completeProfile() {
    const username = document.getElementById('username');
    const email = document.getElementById('email');
    
    if (!username || !email || !username.value || !email.value) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Here we would:
    // 1. Connect to Hedera using API
    // 2. Create a user profile associated with the wallet
    // 3. Store the username and email in a database
    
    closeAuthModal();
    alert("Profile created successfully! Welcome to HASHCLOUT."); // Replace with redirect in real implementation
}

// Login Modal Functions
function openAuthModal(type) {
    const loginModalOverlay = document.getElementById('loginModalOverlay');
    
    if (loginModalOverlay) {
        loginModalOverlay.style.display = 'flex';
        
        if (type === 'signup') {
            showSignupStep();
        } else {
            showLoginStep();
        }
    }
}

function closeLoginModal() {
    const loginModalOverlay = document.getElementById('loginModalOverlay');
    
    if (loginModalOverlay) {
        loginModalOverlay.style.display = 'none';
    }
}

function showLoginStep() {
    const loginStep = document.getElementById('loginStep');
    const signupStep = document.getElementById('signupStep');
    const forgotPasswordStep = document.getElementById('forgotPasswordStep');
    
    if (loginStep) {
        loginStep.style.display = 'block';
    }
    
    if (signupStep) {
        signupStep.style.display = 'none';
    }
    
    if (forgotPasswordStep) {
        forgotPasswordStep.style.display = 'none';
    }
}

function showSignupStep() {
    const loginStep = document.getElementById('loginStep');
    const signupStep = document.getElementById('signupStep');
    const forgotPasswordStep = document.getElementById('forgotPasswordStep');
    
    if (loginStep) {
        loginStep.style.display = 'none';
    }
    
    if (signupStep) {
        signupStep.style.display = 'block';
    }
    
    if (forgotPasswordStep) {
        forgotPasswordStep.style.display = 'none';
    }
}

function showForgotPassword() {
    const loginStep = document.getElementById('loginStep');
    const signupStep = document.getElementById('signupStep');
    const forgotPasswordStep = document.getElementById('forgotPasswordStep');
    
    if (loginStep) {
        loginStep.style.display = 'none';
    }
    
    if (signupStep) {
        signupStep.style.display = 'none';
    }
    
    if (forgotPasswordStep) {
        forgotPasswordStep.style.display = 'block';
    }
}

// Hedera integration functions - to be implemented
async function checkHederaBalance(accountId) {
    try {
        // This function will be implemented with the Hedera SDK
        // For now it returns a mock value
        return {
            success: true,
            balance: "0.0 HBAR",
            accountId: accountId
        };
    } catch (error) {
        console.error("Error checking Hedera balance:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Placeholder for Hedera transaction functions
async function sendHbarTip(recipientId, amount) {
    // This will be implemented with the Hedera SDK
    console.log(`Would send ${amount} HBAR to ${recipientId}`);
    return {
        success: true,
        txId: "mock-transaction-id"
    };
}