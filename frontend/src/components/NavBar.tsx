import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function NavBar() {
  const role = localStorage.getItem('userRole')?.toLowerCase();
  const location = useLocation();
  const navigate = useNavigate();
  const isRecordPage = location.pathname === '/record'
  if (!role) return null;

  const items: { path: string; label: string }[] = [];
  if (['recorder','admin','superadmin'].includes(role)) items.push({ path: '/record', label: '录货' });
  if (['qc','admin','superadmin'].includes(role))      items.push({ path: '/qc',     label: '质检' });
  if (['recorder','admin','superadmin'].includes(role)) items.push({ path: '/stats',  label: '统计' });
  if (role === 'superadmin')                            items.push({ path: '/admin', label: '用户管理' });

  // 退出登录：清理 localStorage 和 axios 头部并跳转到 login
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    // 如果您在 axios 全局设置了 Authorization，可以同时删除：
    // delete api.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  return (
    <nav className="w-full flex items-center flex-wrap bg-gray-100 border-b p-2">
      {/* 菜单区域：在小屏幕下自动换行或横向滚动 */}
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap">
        {items.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-1 rounded ${
              location.pathname === item.path
                ? 'bg-blue-500 text-white'
                : 'text-blue-600 hover:bg-blue-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {/* 占位符拉伸，让 Logout 贴到最右侧 */}
      <div className="flex-1"></div>
      {/* 如果不是录货页，才显示全局登出 */}
      {!isRecordPage && (
        <button
          onClick={handleLogout}
          className="text-red-500 hover:underline px-3 py-1"
        >
         退出
       </button>
     )}
    </nav>
  );
}
