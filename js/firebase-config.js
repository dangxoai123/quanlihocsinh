// Firebase Configuration
// =====================================================
// HƯỚNG DẪN: Thay thế các giá trị bên dưới bằng config từ Firebase Console
// 1. Truy cập https://console.firebase.google.com
// 2. Tạo project mới hoặc chọn project có sẵn
// 3. Vào Project Settings > General > Your apps > Web app
// 4. Copy config và dán vào đây
// 5. Bật Authentication (Email/Password) trong Firebase Console
// 6. Bật Firestore Database trong Firebase Console
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyBqH83JLLldfYCICYoFhtjvrJjmZGw_4d8",
  authDomain: "hocsinh-d270a.firebaseapp.com",
  projectId: "hocsinh-d270a",
  storageBucket: "hocsinh-d270a.firebasestorage.app",
  messagingSenderId: "771839827436",
  appId: "1:771839827436:web:e467a5bba62f66306a74c9",
  measurementId: "G-SNDFNK9W2Y"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
