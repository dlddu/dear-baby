import 'package:flutter_test/flutter_test.dart';
import 'package:dear_baby/main.dart';

void main() {
  testWidgets('Health check page renders correctly', (tester) async {
    await tester.pumpWidget(const DearBabyApp());

    expect(find.text('Unknown'), findsOneWidget);
    expect(find.text('Check Health'), findsOneWidget);
  });
}
