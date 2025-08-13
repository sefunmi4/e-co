#include <QApplication>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QWidget>
#include <QObject>
#include <QUdpSocket>
#include <QNetworkDatagram>
#include <QCursor>

#ifdef Q_OS_WIN
#include <windows.h>
#endif

// Desktop Qt demo with three independent layers (background, middle,
// foreground) and a control panel to select which layer is interactive.
// Non-active layers ignore mouse events so input falls through to the chosen
// window. Layer changes are broadcast over UDP so peers on the local network
// stay in sync.

class NetworkStorage : public QObject {
    Q_OBJECT
public:
    NetworkStorage(QObject* parent = nullptr) : QObject(parent) {
        socket.bind(45454, QUdpSocket::ShareAddress);
        connect(&socket, &QUdpSocket::readyRead, this, &NetworkStorage::onReady);
    }

    void publish(const QString& layer) {
        socket.writeDatagram(layer.toUtf8(), QHostAddress::Broadcast, 45454);
    }

signals:
    void layerChanged(const QString& layer);

private slots:
    void onReady() {
        while (socket.hasPendingDatagrams()) {
            QNetworkDatagram d = socket.receiveDatagram();
            emit layerChanged(QString::fromUtf8(d.data()));
        }
    }

private:
    QUdpSocket socket;
};

// Very basic wallpaper setter placeholder.
void setWallpaper(const QString& path) {
#ifdef Q_OS_WIN
    SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, (void*)path.utf16(),
                          SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE);
#else
    Q_UNUSED(path);
    // TODO: implement for macOS and Linux using platform APIs.
#endif
}

// Example cursor control utility.
void moveCursor(int x, int y) {
    QCursor::setPos(x, y);
}

int main(int argc, char** argv) {
    QApplication app(argc, argv);

    NetworkStorage storage;
    setWallpaper("wallpaper.jpg");

    // Background layer simulating a wallpaper.
    QWidget background;
    background.setWindowTitle("Background Layer");
    background.resize(800, 600);
    background.setStyleSheet("background-color: #003366;");
    background.setWindowFlag(Qt::WindowStaysOnBottomHint);
    background.show();

    // Middle layer representing an application window.
    QWidget middle;
    middle.setWindowTitle("Middle Layer");
    middle.resize(400, 300);
    middle.move(200, 150);
    QLabel midLabel("Middleware App", &middle);
    QVBoxLayout midLayout;
    midLayout.addWidget(&midLabel);
    middle.setLayout(&midLayout);
    middle.show();

    // Foreground layer for gesture or cursor interaction.
    QWidget foreground;
    foreground.setWindowTitle("Foreground Layer");
    foreground.resize(800, 600);
    foreground.setWindowFlag(Qt::FramelessWindowHint);
    foreground.setWindowFlag(Qt::Tool);
    foreground.setWindowFlag(Qt::WindowStaysOnTopHint);
    foreground.setAttribute(Qt::WA_TransparentForMouseEvents, true);
    foreground.show();

    // Control panel with buttons to select the active layer.
    QWidget panel;
    panel.setWindowTitle("Layer Control");
    QVBoxLayout panelLayout;
    QPushButton toBackground("Background");
    QPushButton toMiddle("Middle");
    QPushButton toForeground("Foreground");
    panelLayout.addWidget(&toBackground);
    panelLayout.addWidget(&toMiddle);
    panelLayout.addWidget(&toForeground);
    panel.setLayout(&panelLayout);
    panel.show();

    auto setActive = [&](QWidget* target, const QString& name) {
        background.setAttribute(Qt::WA_TransparentForMouseEvents, target != &background);
        middle.setAttribute(Qt::WA_TransparentForMouseEvents, target != &middle);
        foreground.setAttribute(Qt::WA_TransparentForMouseEvents, target != &foreground);
        target->raise();
        target->activateWindow();
        storage.publish(name);
        if (target == &foreground) {
            QApplication::setOverrideCursor(Qt::CrossCursor);
            moveCursor(foreground.width() / 2, foreground.height() / 2);
        } else {
            QApplication::restoreOverrideCursor();
        }
    };

    QObject::connect(&toBackground, &QPushButton::clicked, [&]() { setActive(&background, "background"); });
    QObject::connect(&toMiddle, &QPushButton::clicked, [&]() { setActive(&middle, "middle"); });
    QObject::connect(&toForeground, &QPushButton::clicked, [&]() { setActive(&foreground, "foreground"); });

    QObject::connect(&storage, &NetworkStorage::layerChanged, [&](const QString& layer) {
        if (layer == "background") setActive(&background, layer);
        else if (layer == "middle") setActive(&middle, layer);
        else if (layer == "foreground") setActive(&foreground, layer);
    });

    return app.exec();
}

#include "main.moc"

