import 'package:go_router/go_router.dart';

import '../features/auth/auth_screen.dart';
import '../features/compare/compare_screen.dart';
import '../features/favorites/favorites_screen.dart';
import '../features/home/home_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/listing/listing_detail_screen.dart';
import '../features/product/product_detail_screen.dart';
import '../features/search/search_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/splash/splash_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/auth',
      builder: (context, state) => const AuthScreen(),
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/compare',
      builder: (context, state) => const CompareScreen(),
    ),
    GoRoute(
      path: '/listing/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? '';
        return ListingDetailScreen(listingId: id);
      },
    ),
    GoRoute(
      path: '/product/:slug',
      builder: (context, state) {
        final slug = state.pathParameters['slug'] ?? '';
        return ProductDetailScreen(slug: slug);
      },
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return AppShell(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/search',
              builder: (context, state) => SearchScreen(
                initialQuery: state.uri.queryParameters['q'] ?? '',
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/favorites',
              builder: (context, state) => const FavoritesScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (context, state) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),
  ],
  redirect: (context, state) {
    final path = state.uri.path;
    if (path == '/') return '/splash';
    return null;
  },
);
