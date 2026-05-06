import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

export const uploadPDF = (file) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/upload", form);
};

export const extractCase = (caseId) =>
  API.post(`/extract/${caseId}`);

export const getReview = (caseId) =>
  API.get(`/review/${caseId}`);

export const verifyCase = (caseId, data) =>
  API.put(`/verify/${caseId}`, data);

export const rejectCase = (caseId, reason) =>
  API.put(`/reject/${caseId}`, { reason });

export const getDashboard = (filters = {}) =>
  API.get("/dashboard", { params: filters });