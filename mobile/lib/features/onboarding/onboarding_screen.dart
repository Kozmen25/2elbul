import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/app_preferences.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  final _pages = const [
    _OnboardingPageData(
      title: 'Fiyatları tek yerde gör',
      body: 'İkinci el ürünlerin fiyat bandını, fırsatlarını ve risklerini tek akışta takip et.',
    ),
    _OnboardingPageData(
      title: 'Karar destekli alışveriş',
      body: 'AI kartları, güven skorları ve fiyat geçmişi ile daha net karar ver.',
    ),
    _OnboardingPageData(
      title: 'Kaydet, izle, uyarı al',
      body: 'Favoriler, fiyat alarmları ve bildirimlerle iyi fırsatları kaçırma.',
    ),
  ];

  Future<void> _finish() async {
    await ref.read(appPreferencesControllerProvider.notifier).completeOnboarding();
    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _finish,
                  child: const Text('Atla'),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: _pages.length,
                  onPageChanged: (value) => setState(() => _index = value),
                  itemBuilder: (context, index) {
                    final page = _pages[index];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '2ElBul',
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          page.title,
                          style: Theme.of(context).textTheme.displaySmall?.copyWith(
                                fontWeight: FontWeight.w900,
                                height: 1.05,
                              ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          page.body,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ],
                    );
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _pages.length,
                  (dotIndex) => AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    height: 8,
                    width: _index == dotIndex ? 22 : 8,
                    decoration: BoxDecoration(
                      color: _index == dotIndex
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.outlineVariant,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _index == _pages.length - 1
                    ? _finish
                    : () => _controller.nextPage(
                          duration: const Duration(milliseconds: 280),
                          curve: Curves.easeOut,
                        ),
                child: Text(
                  _index == _pages.length - 1 ? 'Başla' : 'Devam et',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingPageData {
  const _OnboardingPageData({required this.title, required this.body});

  final String title;
  final String body;
}

