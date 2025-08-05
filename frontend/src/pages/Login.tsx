import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * 登录页面。
 *
 * 向后端发送用户名和密码并获取 JWT 令牌。
 * 登录成功后，令牌和角色将存储到 localStorage，
 * 并设置 Axios 默认 Authorization 头。根据角色跳转到相应页面。
 */
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    try {
      // API 基础地址来自 .env 中的 VITE_API_BASE_URL，默认使用本地地址。
      const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      const res = await axios.post(
        `${base}/api/login`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      // 返回的数据包括 access_token、role 和 username
      const { access_token, role, username: returnedUsername } = res.data;
      // 保存令牌和用户信息
      localStorage.setItem('access_token', access_token);
      if (role) {
        localStorage.setItem('userRole', role.toLowerCase());
      }
      localStorage.setItem('username', returnedUsername);
      // 将 Authorization 头设置为默认值以便后续请求携带
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      // 根据角色跳转
      switch ((role || '').toLowerCase()) {
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
          navigate('/admin');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      console.error('Login failed', err);
      setError('登录失败，请检查用户名和密码是否正确');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-sm p-4 bg-white rounded shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-center">用户登录</h2>
        <div className="mb-3">
          <label className="block mb-1">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="请输入用户名"
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="请输入密码"
          />
        </div>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          登录
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
