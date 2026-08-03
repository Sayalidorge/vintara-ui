// src/services/RevenueService.js
import config from "../config";

// Get Yearly Revenue
export const getYearlyRevenue = (year) => {
  const url = `${config.BASE_URL}/api/admin/revenue/yearly?year=${year}`;
  return fetch(url, {
    method: "GET",
    headers: config.getHeaders(),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error("Error fetching yearly revenue:", error);
      throw error;
    });
};

// Get Daily Revenue
export const getDailyRevenue = (year, month) => {
  const url = `${config.BASE_URL}/api/admin/revenue/daily?year=${year}&month=${month}`;
  return fetch(url, {
    method: "GET",
    headers: config.getHeaders(),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error("Error fetching daily revenue:", error);
      throw error;
    });
};

// Resort Yearly Revenue
export const getResortYearlyRevenue = (resortId, year) => {
  const url = `${config.BASE_URL}/api/admin/revenue/resort-yearly?resortId=${resortId}&year=${year}`;
  return fetch(url, {
    method: "GET",
    headers: config.getHeaders(),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error("Error fetching resort yearly revenue:", error);
      throw error;
    });
};

// Resort Daily Revenue
export const getResortDailyRevenue = (resortId, year, month) => {
  const url = `${config.BASE_URL}/api/admin/revenue/resort-daily?resortId=${resortId}&year=${year}&month=${month}`;
  return fetch(url, {
    method: "GET",
    headers: config.getHeaders(),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error("Error fetching resort daily revenue:", error);
      throw error;
    });
};