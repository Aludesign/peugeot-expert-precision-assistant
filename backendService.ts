
import { ChatSession, User, Complaint } from './types';

const SESSION_KEY = 'peugeot_precision_sessions_v1';
const USER_KEY = 'peugeot_precision_auth_v1';
const COMPLAINT_KEY = 'peugeot_precision_complaints_v1';

export const backend = {
  getSessions: (): ChatSession[] => {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveSessions: (sessions: ChatSession[]) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  },
  getUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  saveUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    // keeping complaints
  },
  getComplaints: (): Complaint[] => {
    const data = localStorage.getItem(COMPLAINT_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveComplaint: (complaint: Complaint) => {
    const data = localStorage.getItem(COMPLAINT_KEY);
    const complaints = data ? JSON.parse(data) : [];
    complaints.push(complaint);
    localStorage.setItem(COMPLAINT_KEY, JSON.stringify(complaints));
  }
};
