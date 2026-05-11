import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ModuleDetail from "./pages/ModuleDetail";
import GroupDetail from "./pages/GroupDetail";
import SessionDetail from "./pages/SessionDetail";
import SpoofLog from "./pages/SpoofLog";
import ActivityLog from "./pages/ActivityLog";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";
import RegisterStudent from "./pages/RegisterStudent";
import Attendance from "./pages/Attendance";
import AddModule from "./pages/AddModule";
import StudentsList from "./pages/StudentsList";
import TeachersList from "./pages/TeachersList";
import ModulesList from "./pages/ModulesList";
import Assignments from "./pages/Assignments";
import Timetable from "./pages/Timetable";
import ScheduleSession from "./pages/ScheduleSession";
import StudentProfile from "./pages/StudentProfile";
import AttendanceHistory from "./pages/AttendanceHistory";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const { session, loading, isTeacher } = useAuth();

  // Wait until session AND teacher check are both resolved.
  if (loading || (session && isTeacher === null)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  // Not logged in, or useAuth already signed them out (not a teacher).
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/modules" element={<ModulesList />} />
                <Route path="/modules/add" element={<AddModule />} />
                <Route path="/modules/:id" element={<ModuleDetail />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/sessions/:id" element={<SessionDetail />} />
                <Route path="/students" element={<StudentsList />} />
                <Route path="/teachers" element={<TeachersList />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/schedule" element={<ScheduleSession />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route
                  path="/students/register"
                  element={<RegisterStudent />}
                />
                <Route path="/students/:id" element={<StudentProfile />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/history" element={<AttendanceHistory />} />
                <Route path="/security" element={<Security />} />
                <Route path="/security/spoof-log" element={<SpoofLog />} />
                <Route path="/admin/activity" element={<ActivityLog />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
