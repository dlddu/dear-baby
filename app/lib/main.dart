import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

const String defaultBaseUrl = 'http://10.0.2.2:8080';

void main() {
  runApp(const DearBabyApp());
}

class DearBabyApp extends StatelessWidget {
  const DearBabyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DearBaby',
      theme: ThemeData(
        colorSchemeSeed: Colors.pink,
        useMaterial3: true,
      ),
      home: const HealthCheckPage(),
    );
  }
}

class HealthCheckPage extends StatefulWidget {
  final String baseUrl;

  const HealthCheckPage({super.key, this.baseUrl = defaultBaseUrl});

  @override
  State<HealthCheckPage> createState() => _HealthCheckPageState();
}

class _HealthCheckPageState extends State<HealthCheckPage> {
  String _status = 'Unknown';

  Future<void> _checkHealth() async {
    try {
      final response = await http
          .get(Uri.parse('${widget.baseUrl}/health'))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _status = (body['status'] as String).toUpperCase();
        });
      } else {
        setState(() {
          _status = 'Error';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error';
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
            Text(
              _status,
              key: const Key('health_status'),
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              key: const Key('health_button'),
              onPressed: _checkHealth,
              child: const Text('Check Health'),
            ),
          ],
        ),
      ),
    );
  }
}
