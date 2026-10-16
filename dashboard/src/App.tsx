import { Route, Routes } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { ToastContainer } from "./components/ui/ToastContainer";
import { Analytics } from "./pages/Analytics";
import { BrandRequests } from "./pages/BrandRequests";
import { BrandsManager } from "./pages/BrandsManager";
import { CategoriesManager } from "./pages/CategoriesManager";
import { DiscoverBrand } from "./pages/DiscoverBrand";
import { EmailManager } from "./pages/EmailManager";
import { Insights } from "./pages/Insights";
import { NotificationManager } from "./pages/NotificationManager";
import { OfferDiscovery } from "./pages/OfferDiscovery";
import { OffersManager } from "./pages/OffersManager";
import { Overview } from "./pages/Overview";
import { PipelineCenter } from "./pages/PipelineCenter";
import { SocialScraperTest } from "./pages/SocialScraperTest";
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
import { ForgotPasswordPage } from "./pages/public/ForgotPasswordPage";
import { SignInPage } from "./pages/public/SignInPage";
import { SignUpPage } from "./pages/public/SignUpPage";
import { TermsConditionsPage } from "./pages/public/TermsConditionsPage";
import { Settings } from "./pages/Settings";
import { Search } from "./pages/Search";
import { UnknownEmailsManager } from "./pages/UnknownEmailsManager";
import { WebsiteScraper } from "./pages/WebsiteScraper";
import { WebsiteScraperBrand } from "./pages/WebsiteScraperBrand";
import { WebsiteScraperTest } from "./pages/WebsiteScraperTest";

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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Single AppShell for all admin pages — avoids remounting the session
            gate (and its full-page loader) on every sidebar navigation. */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/search" element={<Search />} />
          <Route path="/offers" element={<OffersManager />} />
          <Route path="/brands" element={<BrandsManager />} />
          <Route path="/manage-categories" element={<CategoriesManager />} />
          <Route path="/discover-brand" element={<DiscoverBrand />} />
          <Route path="/offer-discovery" element={<OfferDiscovery />} />
          <Route path="/social-scraper-test" element={<SocialScraperTest />} />
          <Route path="/website-scraper" element={<WebsiteScraper />} />
          <Route path="/website-scraper/brands/:brandId" element={<WebsiteScraperBrand />} />
          <Route path="/website-scraper-test" element={<WebsiteScraperTest />} />
          <Route path="/emails" element={<EmailManager />} />
          <Route path="/unknown-emails" element={<UnknownEmailsManager />} />
          <Route path="/brand-requests" element={<BrandRequests />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/notifications" element={<NotificationManager />} />
          <Route path="/pipeline" element={<PipelineCenter />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
