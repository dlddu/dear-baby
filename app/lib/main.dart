import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const DearBabyApp());
}

String get backendBaseUrl {
  if (Platform.isAndroid) {
    return 'http://10.0.2.2:8080';
  }
  return 'http://127.0.0.1:8080';
}

class DearBabyApp extends StatelessWidget {
  const DearBabyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DearBaby',
      home: const HealthCheckScreen(),
    );
  }
}

class HealthCheckScreen extends StatefulWidget {
  const HealthCheckScreen({super.key});

  @override
  State<HealthCheckScreen> createState() => _HealthCheckScreenState();
}

class _HealthCheckScreenState extends State<HealthCheckScreen> {
  String _status = '';
  bool _loading = false;

  Future<void> _checkHealth() async {
    setState(() {
      _loading = true;
      _status = '';
    });

    try {
      final response = await http
          .get(Uri.parse('$backendBaseUrl/health'))
          .timeout(const Duration(seconds: 10));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() {
        _status = body['status'] as String? ?? 'unknown';
      });
    } catch (e) {
      setState(() {
        _status = 'error';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('DearBaby Health Check')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              key: const Key('check-health-btn'),
              onPressed: _loading ? null : _checkHealth,
              child: const Text('Check Health'),
            ),
            const SizedBox(height: 24),
            if (_loading) const CircularProgressIndicator(),
            if (_status.isNotEmpty)
              Text(
                _status,
                key: const Key('health-status'),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
          ],
        ),
      ),
    );
  }
}
