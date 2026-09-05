import { Route, Routes } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { ToastContainer } from "./components/ui/ToastContainer";
import { Analytics } from "./pages/Analytics";
import { BrandRequests } from "./pages/BrandRequests";
import { BrandsManager } from "./pages/BrandsManager";
import { EmailManager } from "./pages/EmailManager";
import { Insights } from "./pages/Insights";
import { NotificationManager } from "./pages/NotificationManager";
import { OffersManager } from "./pages/OffersManager";
import { Overview } from "./pages/Overview";
import { PipelineCenter } from "./pages/PipelineCenter";
import { AccountPage } from "./pages/public/AccountPage";
import { BrandDetailPage } from "./pages/public/BrandDetailPage";
import { BrandsPage } from "./pages/public/BrandsPage";
import { CategoriesPage } from "./pages/public/CategoriesPage";
import { ContactPage } from "./pages/public/ContactPage";
import { DealsPage } from "./pages/public/DealsPage";
import { FavoritesPage } from "./pages/public/FavoritesPage";
import { HelpSupportPage } from "./pages/public/HelpSupportPage";
import { OfferDetailPage } from "./pages/public/OfferDetailPage";
import { PrivacyPolicyPage } from "./pages/public/PrivacyPolicyPage";
import { PublicOffers } from "./pages/public/PublicOffers";
import { SearchPage } from "./pages/public/SearchPage";
import { SignInPage } from "./pages/public/SignInPage";
import { SignUpPage } from "./pages/public/SignUpPage";
import { TermsConditionsPage } from "./pages/public/TermsConditionsPage";
import { Settings } from "./pages/Settings";
import { Search } from "./pages/Search";
import { UnknownEmailsManager } from "./pages/UnknownEmailsManager";

function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<PublicOffers />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/deals/brands" element={<BrandsPage />} />
        <Route path="/deals/search" element={<SearchPage />} />
        <Route path="/deals/brand/:name" element={<BrandDetailPage />} />
        <Route path="/deals/:id" element={<OfferDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/help" element={<HelpSupportPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsConditionsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route
          path="/dashboard"
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
          path="/unknown-emails"
          element={
            <AppShell title="Unknown emails">
              <UnknownEmailsManager />
            </AppShell>
          }
        />
        <Route
          path="/brand-requests"
          element={
            <AppShell title="Brand requests">
              <BrandRequests />
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
          path="/notifications"
          element={
            <AppShell title="Notification Management">
              <NotificationManager />
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
