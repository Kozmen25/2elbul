import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/data/app_preferences.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 2, vsync: this);
  final _emailController = TextEditingController(text: 'demo@2elbul.com');
  final _passwordController = TextEditingController(text: '123456');

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    await ref
        .read(appPreferencesControllerProvider.notifier)
        .updateSessionEmail(_emailController.text.trim());
    if (!mounted) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: 'Giriş'),
                  Tab(text: 'Kayıt'),
                ],
              ),
              const SizedBox(height: 20),
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _AuthForm(
                      emailController: _emailController,
                      passwordController: _passwordController,
                      primaryLabel: 'Giriş yap',
                      onSubmit: _submit,
                      subtitle: 'Favoriler, alarmlar ve geçmiş için oturum aç.',
                    ),
                    _AuthForm(
                      emailController: _emailController,
                      passwordController: _passwordController,
                      primaryLabel: 'Hesap oluştur',
                      onSubmit: _submit,
                      subtitle: 'Demo hesapla giriş yapıp uygulamayı keşfedebilirsin.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AuthForm extends StatelessWidget {
  const _AuthForm({
    required this.emailController,
    required this.passwordController,
    required this.primaryLabel,
    required this.onSubmit,
    required this.subtitle,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final String primaryLabel;
  final VoidCallback onSubmit;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(subtitle),
          const SizedBox(height: 20),
          TextField(
            controller: emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-posta'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Parola'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: onSubmit,
            child: Text(primaryLabel),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () {},
            child: const Text('Parolamı unuttum'),
          ),
        ],
      ),
    );
  }
}

