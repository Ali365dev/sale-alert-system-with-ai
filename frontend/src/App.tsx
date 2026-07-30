import { Route, Routes } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { ToastContainer } from "./components/ui/ToastContainer";
import { Analytics } from "./pages/Analytics";
import { BrandsManager } from "./pages/BrandsManager";
import { EmailManager } from "./pages/EmailManager";
import { Insights } from "./pages/Insights";
import { OffersManager } from "./pages/OffersManager";
import { Overview } from "./pages/Overview";
import { PipelineCenter } from "./pages/PipelineCenter";
import { Settings } from "./pages/Settings";
import { Search } from "./pages/Search";

function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route
          path="/"
          element={
            <AppShell title="Overview">
              <Overview />
            </AppShell>
          }
        />
        <Route
          path="/analytics"
          element={
            <AppShell title="Analytics">
              <Analytics />
            </AppShell>
          }
        />
        <Route
          path="/search"
          element={
            <AppShell title="Search">
              <Search />
            </AppShell>
          }
        />
        <Route
          path="/offers"
          element={
            <AppShell title="Offers manager">
              <OffersManager />
            </AppShell>
          }
        />
        <Route
          path="/brands"
          element={
            <AppShell title="Brands manager">
              <BrandsManager />
            </AppShell>
          }
        />
        <Route
          path="/emails"
          element={
            <AppShell title="Email manager">
              <EmailManager />
            </AppShell>
          }
        />
        <Route
          path="/insights"
          element={
            <AppShell title="AI insights">
              <Insights />
            </AppShell>
          }
        />
        <Route
          path="/pipeline"
          element={
            <AppShell title="Pipeline Center">
              <PipelineCenter />
            </AppShell>
          }
        />
        <Route
          path="/settings"
          element={
            <AppShell title="Settings">
              <Settings />
            </AppShell>
          }
        />
      </Routes>
    </>
  );
}

export default App;
