// Auth Module - Admin Authentication
// ===================================

const Auth = {
    // Check if user is logged in
    checkAuth(callback) {
        auth.onAuthStateChanged(user => {
            callback(user);
        });
    },

    // Login with email and password
    async login(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            let message = 'Đăng nhập thất bại';
            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'Tài khoản không tồn tại';
                    break;
                case 'auth/wrong-password':
                    message = 'Mật khẩu không đúng';
                    break;
                case 'auth/invalid-email':
                    message = 'Email không hợp lệ';
                    break;
                case 'auth/too-many-requests':
                    message = 'Quá nhiều lần thử. Vui lòng thử lại sau';
                    break;
            }
            return { success: false, message };
        }
    },

    // Logout
    async logout() {
        try {
            await auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // Register new admin (use once to create admin account)
    async register(email, password) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            let message = 'Đăng ký thất bại';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = 'Email đã được sử dụng';
                    break;
                case 'auth/weak-password':
                    message = 'Mật khẩu phải có ít nhất 6 ký tự';
                    break;
            }
            return { success: false, message };
        }
    }
};
