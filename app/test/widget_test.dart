import 'package:flutter_test/flutter_test.dart';

import 'package:dear_baby/main.dart';

void main() {
  testWidgets('App renders health check screen', (WidgetTester tester) async {
    await tester.pumpWidget(const DearBabyApp());

    expect(find.text('Check Health'), findsOneWidget);
  });
}
