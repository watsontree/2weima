
import { User } from '../types';

const STORAGE_KEY = 'gen_auth_user';
const DB_KEY = 'gen_user_db';

// Initialize DB with default credentials if empty
const initDB = () => {
  const db = localStorage.getItem(DB_KEY);
  if (!db) {
    localStorage.setItem(DB_KEY, JSON.stringify({
      'wsadwdf': { username: 'wsadwdf', password: 'wsadwdf', role: 'admin' }
    }));
  }
};

export const authService = {
  login: (username: string, password: string): User | null => {
    initDB();
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const userRecord = db[username];

    if (userRecord && userRecord.password === password) {
      const user: User = { username: userRecord.username, role: userRecord.role };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  changePassword: (username: string, oldPass: string, newPass: string): boolean => {
    const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const userRecord = db[username];

    if (userRecord && userRecord.password === oldPass) {
      db[username].password = newPass;
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    }
    return false;
  }
};
