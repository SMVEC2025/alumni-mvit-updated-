// Canonical degree → department lists. This is the SERVER's source of truth for
// what counts as a valid degree/department combination; the API rejects anything
// outside it. Mirrors `departmentOptionsByDegree` in the frontend
// (frontend/src/pages/completeProfile/Index.jsx) — keep the two in sync.
export const DEPARTMENTS_BY_DEGREE = {
  'B.Tech': [
    'Artificial Intelligence and Machine Learning',
    'CSE – IoT and Cyber Security including Blockchain Technology',
    'Computer Science & Engineering',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Food Technology',
    'Information Technology',
    'Mechanical Engineering',
    'Robotics and Automation',
  ],
  'M.Tech': ['Computer Science & Engineering', 'Electronics and Communication Engineering'],
  'Ph.D': ['Electronics and Communication Engineering'],
  'M.B.A': ['Master of Business Administration'],
  // 'MBA' is an accepted alias of 'M.B.A' (the frontend hides it from the degree
  // dropdown but still maps it); keep it valid so older/aliased payloads pass.
  'MBA': ['Master of Business Administration'],
  'BBA': ['Bachelor of Business Administration'],
  'MCA': ['Master of Computer Applications'],
  'BCA': ['Bachelor of Computer Applications'],
}

// All accepted degree labels.
export const DEGREES = Object.keys(DEPARTMENTS_BY_DEGREE)

// True if `department` is a valid department for the given `degree`.
export function isValidDegreeDepartment(degree, department) {
  const list = DEPARTMENTS_BY_DEGREE[degree]
  return Array.isArray(list) && list.includes(department)
}
