export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
}

export const mockUsers = [
  { id: '1', email: 'student@college.edu', password: 'student123', name: 'John Doe', role: 'student' as const },
  { id: '2', email: 'admin@college.edu', password: 'admin123', name: 'Admin User', role: 'admin' as const },
];

export const login = (email: string, password: string): User | null => {
  const user = mockUsers.find(u => u.email === email && u.password === password);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
    return userWithoutPassword;
  }
  return null;
};

export const signup = (email: string, password: string, name: string): User | null => {
  const existingUser = mockUsers.find(u => u.email === email);
  if (existingUser) {
    return null;
  }
  
  const newUser = {
    id: Date.now().toString(),
    email,
    name,
    role: 'student' as const
  };
  
  mockUsers.push({ ...newUser, password });
  localStorage.setItem('currentUser', JSON.stringify(newUser));
  return newUser;
};

export const logout = () => {
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
};
