// src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/login`, { username, password });
      if (res.data.success) {
        const role = (res.data.role || '').toLowerCase();
        localStorage.setItem('userRole', role);
        localStorage.setItem('username', res.data.username);

        // 根据角色跳转
        switch (role) {
          case 'recorder':
            navigate('/record');
            break;
          case 'qc':
            navigate('/qc');
            break;
          case 'admin':
            navigate('/stats');
            break;
          case 'superadmin':
            navigate('/admin');  // 你可以自己定义管理用户界面路由
            break;
          default:
            setError('未知角色，无法跳转');
        }
      } else {
        setError('账号或密码错误');
      }
    } catch {
      setError('登录失败，请检查服务器');
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Chill Mart</h1>

        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Please enter username"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Please enter password"
          />
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          Login
        </button>

        {error && <p className="text-red-600 text-center mt-4">{error}</p>}
      </div>
    </div>
  )
}
