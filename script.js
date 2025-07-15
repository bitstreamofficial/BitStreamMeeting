// Updated JavaScript code for the new Google Form
const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSf3-srZzj36iu4c42Mbhc7gpX2N4AiYliuqIUUlSArD-KHIDQ/formResponse";
const entryId = "entry.1163406004"; // Updated entry ID for the new form
const meetUrl = "https://meet.google.com/zkg-ykkf-yjb";
const MEETING_TIME = 20; // 8 PM in 24-hour format
const FIXED_SHEET_URL = "https://script.google.com/macros/s/AKfycbzbKsbCnuIbKIcT47i9KHEXzhgQrhlUPyIjuU21BmQXhrNqxg9vsBPMFdfrL6q2vHckUg/exec"; // Replace with your deployed web app URL

let attendanceData = [];

function submitAttendance(name) {
  const button = event.target;
  const loading = document.getElementById('loading');
  
  const buttons = document.querySelectorAll('.join-button');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  });
  
  loading.classList.add('show');
  
  const data = new FormData();
  data.append(entryId, name);

  fetch(formUrl, {
    method: "POST",
    mode: "no-cors",
    body: data
  }).then(() => {
    setTimeout(() => {
      window.location.href = meetUrl;
    }, 500);
  }).catch(() => {
    setTimeout(() => {
      window.location.href = meetUrl;
    }, 500);
  });
}

function loadData() {
  fetchDataFromSheet(FIXED_SHEET_URL);
}

function fetchDataFromSheet(url) {
  updateLoadingState(true);
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.text();
    })
    .then(csvText => {
      parseCSVData(csvText);
      updateDashboard();
      updateLastUpdated();
      updateLoadingState(false);
    })
    .catch(error => {
      console.error('Error loading data:', error);
      updateLoadingState(false);
    });
}

function updateLoadingState(loading) {
  document.getElementById('overallAttendance').textContent = loading ? 'Loading...' : '--';
}

function updateLastUpdated() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  document.getElementById('lastUpdated').textContent = 
    `Last updated: ${timeString}`;
}

function parseCSVData(csvText) {
  const lines = csvText.split('\n');
  const data = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle both comma and tab separators
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    
    if (parts.length >= 2) {
      const timestamp = parts[0].trim();
      const name = parts[1].trim();
      
      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          data.push({
            timestamp: date,
            name: name,
            dateString: date.toDateString()
          });
        }
      } catch (e) {
        console.error('Error parsing date:', timestamp);
      }
    }
  }
  
  // Data is already sorted by date (newest first) from the Apps Script
  // Filter to only first entry per person per day after 8 PM
  attendanceData = filterFirstDailyEntries(data);
  console.log('Processed attendance data:', attendanceData.length, 'entries');
}

function filterFirstDailyEntries(data) {
  const dailyEntries = {};
  
  data.forEach(entry => {
    const dateKey = `${entry.dateString}-${entry.name}`;
    const hour = entry.timestamp.getHours();
    
    // Only consider entries after 8 PM
    if (hour >= MEETING_TIME) {
      if (!dailyEntries[dateKey] || entry.timestamp < dailyEntries[dateKey].timestamp) {
        dailyEntries[dateKey] = entry;
      }
    }
  });
  
  return Object.values(dailyEntries);
}

function calculateLateness(timestamp) {
  const meetingTime = new Date(timestamp);
  meetingTime.setHours(MEETING_TIME, 0, 0, 0);
  
  const diffMs = timestamp - meetingTime;
  return Math.max(0, Math.floor(diffMs / 60000)); // Minutes late
}

function updateDashboard() {
  if (attendanceData.length === 0) {
    document.getElementById('overallAttendance').textContent = 'No Data';
    document.getElementById('individualStats').innerHTML = '<div class="no-data">No data available</div>';
    return;
  }

  const now = new Date();
  const thisMonth = attendanceData.filter(entry => 
    entry.timestamp.getMonth() === now.getMonth() && 
    entry.timestamp.getFullYear() === now.getFullYear()
  );

  // Calculate statistics
  const stats = calculateStats(thisMonth);
  
  // Update UI
  updateStatsCards(stats);
  updateIndividualStats(stats);
}

function calculateStats(monthData) {
  const names = ['Rafi', 'Shakib', 'Sabbir'];
  
  // Calculate monthly stats
  const monthlyStats = {};
  monthData.forEach(entry => {
    const lateness = calculateLateness(entry.timestamp);
    if (!monthlyStats[entry.name]) {
      monthlyStats[entry.name] = { total: 0, totalLateness: 0, lateCount: 0 };
    }
    monthlyStats[entry.name].total++;
    monthlyStats[entry.name].totalLateness += lateness;
    if (lateness > 0) monthlyStats[entry.name].lateCount++;
  });

  // Overall attendance
  const totalPossibleDays = getWorkingDaysThisMonth();
  const totalAttendance = Object.values(monthlyStats).reduce((sum, s) => sum + s.total, 0);
  const overallAttendance = totalPossibleDays > 0 ? Math.round((totalAttendance / (totalPossibleDays * names.length)) * 100) : 0;

  return {
    overallAttendance,
    monthlyStats,
    totalPossibleDays,
    names
  };
}

function getWorkingDaysThisMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  
  let workingDays = 0;
  for (let day = 1; day <= today; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      workingDays++;
    }
  }
  return workingDays;
}

function updateStatsCards(stats) {
  // Overall Attendance
  document.getElementById('overallAttendance').textContent = stats.overallAttendance + '%';
  document.getElementById('attendanceProgress').style.width = stats.overallAttendance + '%';
  document.getElementById('attendanceDetail').textContent = 
    `${Object.values(stats.monthlyStats).reduce((sum, s) => sum + s.total, 0)} / ${stats.totalPossibleDays * 3} possible attendances`;
}

function updateIndividualStats(stats) {
  const individualContainer = document.getElementById('individualStats');
  individualContainer.innerHTML = '';

  stats.names.forEach(name => {
    const stat = stats.monthlyStats[name] || { total: 0, totalLateness: 0, lateCount: 0 };
    
    // Calculate attendance percentage
    const attendanceRate = stats.totalPossibleDays > 0 ? Math.round((stat.total / stats.totalPossibleDays) * 100) : 0;
    
    // Calculate average lateness
    const avgLateness = stat.total > 0 ? Math.round(stat.totalLateness / stat.total) : 0;
    
    const personDiv = document.createElement('div');
    personDiv.className = 'person-stat';
    
    personDiv.innerHTML = `
      <div class="person-name">${name}</div>
      <div class="person-stats-details">
        <div class="person-attendance">Attendance: ${attendanceRate}%</div>
        <div class="person-lateness">Avg Late: ${avgLateness} min</div>
      </div>
    `;
    
    individualContainer.appendChild(personDiv);
  });
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load data automatically when page loads
  loadData();
  
  // Update dashboard initially
  updateDashboard();
});
